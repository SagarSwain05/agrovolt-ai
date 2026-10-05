const crypto = require("crypto");
const Farm = require("../models/Farm");
const Device = require("../models/Device");
const Telemetry = require("../models/Telemetry");
const virtualNode = require("../services/virtualNode");

const DEVICE_FRESH_MS = 15 * 60 * 1000;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const NUMERIC_FIELDS = [
  "ambientTempC", "underCanopyTempC", "humidityPct", "panelTempC", "irradianceWm2", "lux", "parCrop",
  "soilMoisturePct", "soilTempC", "soilN", "soilP", "soilK", "soilPH", "powerW", "energyTodayKwh", "panelTiltDeg",
];

async function farmFor(user) {
  return Farm.findOne({ userId: user._id });
}

/**
 * Latest reading. Fields measured by a physical device in the last 15 min take
 * precedence; anything the device does not measure comes from the virtual node.
 * `measured` lists which fields are physical.
 */
async function latestReading(farm) {
  const [dev, v] = await Promise.all([
    Telemetry.findOne({ farmId: farm._id, source: "device", ts: { $gte: new Date(Date.now() - DEVICE_FRESH_MS) } }).sort({ ts: -1 }).lean(),
    virtualNode.read(farm).catch(() => null),
  ]);
  if (!dev) return v ? { ...v, measured: [] } : null;
  const measured = NUMERIC_FIELDS.filter((f) => dev[f] != null);
  const merged = { ...(v || {}), source: "device", ts: dev.ts, deviceId: dev.deviceId, measured };
  for (const f of measured) merged[f] = dev[f];
  return merged;
}
exports.latestReading = latestReading;

// @route POST /api/iot/devices  (farmer registers a node; the key is shown once)
exports.registerDevice = async (req, res) => {
  try {
    const farm = await farmFor(req.user);
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    const key = "avk_" + crypto.randomBytes(24).toString("hex");
    const device = await Device.create({
      farmId: farm._id,
      name: (req.body.name || "Field node").slice(0, 60),
      type: req.body.type || "esp32",
      keyHash: sha256(key),
      keyPrefix: key.slice(0, 10),
    });
    res.status(201).json({ success: true, data: { id: device._id, name: device.name, type: device.type, apiKey: key } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not register device" });
  }
};

// @route GET /api/iot/devices
exports.listDevices = async (req, res) => {
  const farm = await farmFor(req.user);
  if (!farm) return res.json({ success: true, data: [] });
  const devices = await Device.find({ farmId: farm._id }).select("-keyHash").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: devices });
};

// @route DELETE /api/iot/devices/:id
exports.deleteDevice = async (req, res) => {
  const farm = await farmFor(req.user);
  if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
  await Device.deleteOne({ _id: req.params.id, farmId: farm._id });
  res.json({ success: true });
};

// @route POST /api/iot/telemetry   header: X-Device-Key   body: reading or { readings: [...] }
exports.ingest = async (req, res) => {
  try {
    const key = req.headers["x-device-key"];
    if (!key) return res.status(401).json({ success: false, message: "Missing X-Device-Key" });
    const device = await Device.findOne({ keyHash: sha256(String(key)), isActive: true });
    if (!device) return res.status(401).json({ success: false, message: "Unknown device key" });

    const batch = Array.isArray(req.body.readings) ? req.body.readings.slice(0, 500) : [req.body];
    const docs = batch.map((r) => {
      const doc = { farmId: device.farmId, deviceId: device._id, source: "device", ts: r.ts ? new Date(r.ts) : new Date() };
      for (const f of NUMERIC_FIELDS) if (r[f] != null && Number.isFinite(Number(r[f]))) doc[f] = Number(r[f]);
      return doc;
    });
    await Telemetry.insertMany(docs);
    device.lastSeenAt = new Date();
    await device.save();
    res.status(201).json({ success: true, accepted: docs.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Ingest failed" });
  }
};

// @route GET /api/iot/latest
exports.latest = async (req, res) => {
  try {
    const farm = await farmFor(req.user);
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    res.json({ success: true, data: await latestReading(farm) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ success: false, message: "Sensor data unavailable" });
  }
};

// @route GET /api/iot/history?hours=24
exports.history = async (req, res) => {
  const farm = await farmFor(req.user);
  if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
  const hours = Math.min(720, Math.max(1, parseInt(req.query.hours) || 24));
  const rows = await Telemetry.find({ farmId: farm._id, ts: { $gte: new Date(Date.now() - hours * 3600000) } })
    .sort({ ts: 1 }).limit(5000).lean();
  res.json({ success: true, data: rows });
};

// @route GET /api/iot/stream?token=   Server-Sent Events, one reading every 15 s.
// Virtual readings are also persisted (at most every 10 min) so history charts fill in.
const lastVirtualSave = new Map();
exports.stream = async (req, res) => {
  const farm = await farmFor(req.user);
  if (!farm) return res.status(404).end();

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();

  const push = async () => {
    try {
      const fresh = await Farm.findById(farm._id); // pick up settings changes
      const r = await latestReading(fresh || farm);
      if (r.source === "virtual") {
        const k = String(farm._id);
        if (!lastVirtualSave.has(k) || Date.now() - lastVirtualSave.get(k) > 10 * 60 * 1000) {
          lastVirtualSave.set(k, Date.now());
          const doc = { farmId: farm._id, source: "virtual", ts: r.ts };
          for (const f of NUMERIC_FIELDS) if (r[f] != null) doc[f] = r[f];
          Telemetry.create(doc).catch(() => {});
        }
      }
      res.write(`event: reading\ndata: ${JSON.stringify(r)}\n\n`);
    } catch (e) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`);
    }
  };
  await push();
  const timer = setInterval(push, 15000);
  req.on("close", () => clearInterval(timer));
};
