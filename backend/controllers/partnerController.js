const crypto = require("crypto");
const Farm = require("../models/Farm");
const User = require("../models/User");
const SolarData = require("../models/SolarData");
const Telemetry = require("../models/Telemetry");
const Device = require("../models/Device");
const PartnerKey = require("../models/PartnerKey");
const solarPosition = require("../mlModels/solarPosition");
const weather = require("../services/weatherService");
const physics = require("../services/agrivoltaicPhysics");

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const PARTNER_ROLES = ["epc", "fpo", "admin"];

function requirePartner(req, res) {
  if (!PARTNER_ROLES.includes(req.user.role)) { res.status(403).json({ success: false, message: "Partner account required" }); return false; }
  return true;
}

// ── Farmer side: link / unlink an installer (EPC) or FPO ──────────────────
// @route POST /api/epc/link { code }   DELETE /api/epc/link
exports.link = async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const partner = await User.findOne({ partnerCode: code, role: { $in: PARTNER_ROLES } }).select("name organization role partnerCode");
  if (!partner) return res.status(404).json({ success: false, message: "Partner code not found" });
  const farm = await Farm.findOneAndUpdate({ userId: req.user._id }, { epcPartnerId: partner._id }, { new: true });
  res.json({ success: true, data: { partner: { name: partner.organization || partner.name, role: partner.role, code: partner.partnerCode }, farmId: farm?._id } });
};
exports.unlink = async (req, res) => {
  await Farm.updateOne({ userId: req.user._id }, { $unset: { epcPartnerId: 1 } });
  res.json({ success: true });
};
exports.myPartner = async (req, res) => {
  const farm = await Farm.findOne({ userId: req.user._id }).populate("epcPartnerId", "name organization role partnerCode").lean();
  const p = farm?.epcPartnerId;
  res.json({ success: true, data: p ? { name: p.organization || p.name, role: p.role, code: p.partnerCode } : null });
};

// ── Partner side: fleet dashboard ─────────────────────────────────────────
// @route GET /api/epc/fleet
exports.fleet = async (req, res) => {
  if (!requirePartner(req, res)) return;
  const q = req.user.role === "admin" && req.query.all === "1" ? { solarInstalled: true } : { epcPartnerId: req.user._id };
  const farms = await Farm.find(q).populate("userId", "name phone").lean();
  const ids = farms.map((f) => f._id);
  const since7 = new Date(Date.now() - 8 * 86400e3);
  const [energy, lastDev, devices] = await Promise.all([
    SolarData.aggregate([
      { $match: { farmId: { $in: ids }, date: { $gte: since7 } } },
      { $sort: { date: 1 } },
      { $group: { _id: "$farmId", days: { $push: { day: "$day", kwh: "$energyProduced", irr: "$irradianceKwhM2", src: "$source", partial: "$isPartial" } } } },
    ]),
    Telemetry.aggregate([{ $match: { farmId: { $in: ids }, source: "device" } }, { $sort: { ts: -1 } }, { $group: { _id: "$farmId", ts: { $first: "$ts" }, powerW: { $first: "$powerW" }, panelTempC: { $first: "$panelTempC" } } }]),
    Device.aggregate([{ $match: { farmId: { $in: ids } } }, { $group: { _id: "$farmId", n: { $sum: 1 } } }]),
  ]);
  const eBy = Object.fromEntries(energy.map((e) => [String(e._id), e.days]));
  const dBy = Object.fromEntries(lastDev.map((d) => [String(d._id), d]));
  const nBy = Object.fromEntries(devices.map((d) => [String(d._id), d.n]));

  const rows = [];
  for (const f of farms) {
    const days = (eBy[String(f._id)] || []).filter((d) => !d.partial);
    const kwh7 = days.reduce((s, d) => s + (d.kwh || 0), 0);
    // Performance ratio: actual vs ideal (capacity × insolation)
    const ideal = days.reduce((s, d) => s + (f.solarCapacityKW || 0) * (d.irr || 0), 0);
    const pr = ideal > 0 ? kwh7 / ideal : null;
    const optimal = solarPosition.getOptimalTilt(f.location.latitude, f.location.longitude);
    let dryDays = null;
    try {
      const om = await weather.getOpenMeteo(f.location.latitude, f.location.longitude, 14);
      const idx = om.daily.time.indexOf(om.current.time.slice(0, 10));
      dryDays = 0;
      for (let i = idx - 1; i >= 0 && (om.daily.precipitation_sum[i] || 0) < 2; i--) dryDays++;
    } catch { /* weather unavailable */ }
    const dev = dBy[String(f._id)];
    const warnings = [];
    if (dryDays != null && dryDays >= 7) warnings.push("soiling");
    if (Math.abs((f.panelTilt ?? optimal) - optimal) >= 5) warnings.push("tilt");
    if (pr != null && pr < 0.65 && days.some((d) => d.src === "device")) warnings.push("underperforming");
    if (nBy[String(f._id)] && (!dev || Date.now() - new Date(dev.ts).getTime() > 6 * 3600e3)) warnings.push("device_offline");
    rows.push({
      farmId: f._id, farmCode: `AV-${String(f._id).slice(-6).toUpperCase()}`, farmer: f.userId?.name, phone: f.userId?.phone,
      district: f.location.district, capacityKW: f.solarCapacityKW, panelCount: f.panelCount, tilt: f.panelTilt, optimalTilt: optimal,
      tiltCompliant: Math.abs((f.panelTilt ?? optimal) - optimal) < 5, kwh7: Math.round(kwh7 * 10) / 10,
      performanceRatio: pr != null ? Math.round(pr * 100) / 100 : null, dryDays, hardwareVerified: !!f.isHardwareVerified,
      devices: nBy[String(f._id)] || 0, lastDeviceAt: dev?.ts || null, livePowerW: dev?.powerW ?? null, warnings,
      daily: days.map((d) => ({ day: d.day, kwh: d.kwh, src: d.src })),
    });
  }
  const totals = {
    farms: rows.length, capacityKW: rows.reduce((s, r) => s + (r.capacityKW || 0), 0), kwh7: Math.round(rows.reduce((s, r) => s + r.kwh7, 0)),
    soiling: rows.filter((r) => r.warnings.includes("soiling")).length, tiltIssues: rows.filter((r) => r.warnings.includes("tilt")).length,
    offline: rows.filter((r) => r.warnings.includes("device_offline")).length,
  };
  res.json({ success: true, data: { partner: { name: req.user.organization || req.user.name, code: req.user.partnerCode, role: req.user.role }, totals, farms: rows } });
};

// ── Partner API keys & webhooks ───────────────────────────────────────────
exports.listKeys = async (req, res) => {
  if (!requirePartner(req, res)) return;
  const keys = await PartnerKey.find({ ownerId: req.user._id }).select("-keyHash -webhookSecret").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: keys });
};
exports.createKey = async (req, res) => {
  if (!requirePartner(req, res)) return;
  const key = "avp_" + crypto.randomBytes(24).toString("hex");
  const secret = "whsec_" + crypto.randomBytes(18).toString("hex");
  const doc = await PartnerKey.create({ ownerId: req.user._id, name: String(req.body?.name || "API key").slice(0, 60), keyHash: sha256(key), keyPrefix: key.slice(0, 10), webhookSecret: secret });
  res.status(201).json({ success: true, data: { id: doc._id, name: doc.name, apiKey: key, webhookSecret: secret } });
};
exports.updateKey = async (req, res) => {
  if (!requirePartner(req, res)) return;
  const pk = await PartnerKey.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!pk) return res.status(404).json({ success: false, message: "Key not found" });
  if (req.body.webhookUrl !== undefined) {
    const u = String(req.body.webhookUrl || "");
    if (u && !/^https:\/\//.test(u)) return res.status(400).json({ success: false, message: "Webhook URL must be https" });
    pk.webhookUrl = u;
  }
  if (Array.isArray(req.body.webhookEvents)) pk.webhookEvents = req.body.webhookEvents;
  if (typeof req.body.isActive === "boolean") pk.isActive = req.body.isActive;
  await pk.save();
  res.json({ success: true });
};
exports.deleteKey = async (req, res) => {
  if (!requirePartner(req, res)) return;
  await PartnerKey.deleteOne({ _id: req.params.id, ownerId: req.user._id });
  res.json({ success: true });
};
exports.testWebhook = async (req, res) => {
  if (!requirePartner(req, res)) return;
  const pk = await PartnerKey.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!pk?.webhookUrl) return res.status(400).json({ success: false, message: "Set a webhook URL first" });
  const ok = await require("../services/webhooks").deliver(pk, "webhook.test", { message: "AgroVolt webhook test" });
  res.json({ success: ok });
};

// ── White-label public API (/api/partner/v1, header X-Api-Key) ─────────────
exports.apiAuth = async (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!key) return res.status(401).json({ error: "Missing X-Api-Key" });
  const pk = await PartnerKey.findOne({ keyHash: sha256(key), isActive: true });
  if (!pk) return res.status(401).json({ error: "Invalid API key" });
  const day = new Date().toISOString().slice(0, 10);
  if (pk.usage?.day !== day) pk.usage = { day, count: 0, total: pk.usage?.total || 0 };
  if (pk.usage.count >= pk.dailyQuota) return res.status(429).json({ error: "Daily quota exceeded" });
  pk.usage.count++; pk.usage.total++; pk.lastUsedAt = new Date();
  await pk.save();
  req.partnerKey = pk;
  next();
};

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

exports.apiCrop = async (req, res) => {
  const b = req.body || {};
  const lat = num(b.lat, null), lon = num(b.lon, null);
  if (lat == null || lon == null) return res.status(400).json({ error: "lat and lon are required" });
  const cur = await weather.getCurrent(lat, lon).catch(() => null);
  const shade = num(b.shadePct, 35);
  const r = require("../mlModels/cropRecommender").recommend({
    soilType: b.soilType || "loamy", rainfall: num(b.rainfall, 1200), season: b.season || require("../services/assistantFallback").currentSeason(),
    shadowCoverage: shade, shadeFactor: shade / 100, temperature: cur?.temperature, humidity: cur?.humidity,
  });
  res.json({ engine: "AgroVolt Shade-Smart Crop Engine", conditions: { lat, lon, shadePct: shade, temperature: cur?.temperature, humidity: cur?.humidity },
    recommendations: r.recommendations.map((c) => ({ crop: c.name, confidence: c.confidence, shadeTolerance: c.shadeTolerance, waterNeed: c.waterReq, daysToHarvest: c.growthDays, yieldKgHa: c.yield, reasoning: c.reasoning })) });
};

exports.apiSolar = async (req, res) => {
  const b = req.body || {};
  const lat = num(b.lat, null), lon = num(b.lon, null), kw = num(b.capacityKW, null);
  if (lat == null || lon == null || !(kw > 0)) return res.status(400).json({ error: "lat, lon and capacityKW are required" });
  const optimal = solarPosition.getOptimalTilt(lat, lon);
  const tf = physics.tiltFactor(num(b.tilt, optimal), optimal);
  const fc = await weather.getForecast(lat, lon);
  const days = fc.forecast.map((f) => {
    const e = physics.dailyEnergy({ capacityKW: kw, peakSunHours: f.radiationKwhM2, tempMaxC: f.tempMax, crop: b.crop || "general", shadeCoveragePct: num(b.shadePct, 35), tiltFactor: tf, et0Mm: f.et0 || 4 });
    return { date: f.date, energyKwh: Math.round(e.energyKwh * 10) / 10, panelTempC: Math.round(e.panelTempC * 10) / 10, bioCoolingC: Math.round(e.bioCoolingDeltaC * 10) / 10, co2AvoidedKg: Math.round(e.co2AvoidedKg * 10) / 10, insolationKwhM2: f.radiationKwhM2 };
  });
  res.json({ engine: "AgroVolt bio-solar model", optimalTiltDeg: optimal, tiltLossPct: Math.round((1 - tf) * 1000) / 10, forecast: days });
};

exports.apiRisk = async (req, res) => {
  const lat = num(req.query.lat, null), lon = num(req.query.lon, null);
  if (lat == null || lon == null) return res.status(400).json({ error: "lat and lon are required" });
  const crops = String(req.query.crops || "").split(",").map((c) => c.trim()).filter(Boolean).map((cropName) => ({ cropName }));
  const r = await require("../services/diseaseRisk").assess({ location: { latitude: lat, longitude: lon }, cropUnderPanels: "general" }, crops);
  res.json({ engine: "AgroVolt microclimate disease early warning", ...r });
};

/** Proxy to the scan controllers, returning their JSON as-is. */
function proxyScan(handler) {
  return (req, res) => {
    if (!req.body?.image) return res.status(400).json({ error: "image (base64 or data URL) is required" });
    return handler(req, res);
  };
}
exports.apiPanelDiagnostics = proxyScan(require("./scanController").scanPanelDefect);
exports.apiCropDiagnostics = proxyScan(require("./scanController").scanCropDisease);
