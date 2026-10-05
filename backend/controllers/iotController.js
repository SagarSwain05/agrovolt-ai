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
  "meterKwhTotal", "voltageV", "currentA", "leafWetnessPct", "rainMm",
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
  if (!dev) return v ? { ...v, measured: [], isHardwareVerified: !!farm.isHardwareVerified } : null;
  const measured = NUMERIC_FIELDS.filter((f) => dev[f] != null);
  const merged = { ...(v || {}), source: "device", ts: dev.ts, deviceId: dev.deviceId, measured, isHardwareVerified: true };
  for (const f of measured) merged[f] = dev[f];
  if (measured.includes("soilMoisturePct")) merged.soilAvailableWaterPct = require("../services/calibration").pawFromVwc(dev.soilMoisturePct, farm.soilType);
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

// @route POST /api/iot/telemetry  and  POST /api/v1/telemetry
// Auth: X-Device-Key header (or Authorization: Device <key>)
exports.ingest = async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const key = req.headers["x-device-key"] || (auth.startsWith("Device ") ? auth.slice(7) : null);
    const out = await require("../services/telemetryIngest").ingest({ key, body: req.body });
    res.status(out.status).json(out.body);
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
  const bus = require("../services/events");
  const onTelemetry = (ev) => { if (ev.farmId === String(farm._id)) push(); };
  bus.on("telemetry", onTelemetry);
  req.on("close", () => { clearInterval(timer); bus.off("telemetry", onTelemetry); });
};
