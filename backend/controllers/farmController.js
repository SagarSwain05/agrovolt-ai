const axios = require("axios");
const Farm = require("../models/Farm");
const User = require("../models/User");
const SolarData = require("../models/SolarData");
const CarbonTransaction = require("../models/CarbonTransaction");
const ledger = require("../services/energyLedger");

const EDITABLE = [
  "farmName", "farmSize", "soilType", "solarInstalled", "solarCapacityKW", "solarSince", "panelHeight",
  "panelTilt", "panelCount", "panelAzimuth", "shadeCoverage", "cropUnderPanels", "tariffPerKwh", "annualRainfall",
];
// Changing any of these alters modelled generation, so the ledger is rebuilt.
const LEDGER_FIELDS = ["solarInstalled", "solarCapacityKW", "solarSince", "panelTilt", "shadeCoverage", "cropUnderPanels", "tariffPerKwh"];

// @route GET /api/farm
exports.getFarm = async (req, res) => {
  let farm = await Farm.findOne({ userId: req.user._id });
  if (!farm) {
    // Accounts created without farm details get a default farm they can edit.
    farm = await Farm.create({
      userId: req.user._id, farmName: `${req.user.name}'s Farm`, farmSize: 2,
      location: { latitude: 20.2961, longitude: 85.8245, district: "Khordha", state: "Odisha" },
    });
    await User.updateOne({ _id: req.user._id }, { farmId: farm._id });
  }
  res.json({ success: true, data: farm });
};

// @route PUT /api/farm
exports.updateFarm = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });

    const before = Object.fromEntries(LEDGER_FIELDS.map((f) => [f, String(farm[f] ?? "")]));
    for (const f of EDITABLE) if (req.body[f] !== undefined) farm[f] = req.body[f];
    const loc = req.body.location;
    if (loc) {
      for (const f of ["latitude", "longitude"]) if (Number.isFinite(Number(loc[f]))) farm.location[f] = Number(loc[f]);
      for (const f of ["address", "district", "state"]) if (loc[f] !== undefined) farm.location[f] = String(loc[f]).slice(0, 120);
    }
    if (farm.solarInstalled && !farm.solarSince) farm.solarSince = new Date();
    await farm.save();

    const locationChanged = loc && (loc.latitude !== undefined || loc.longitude !== undefined);
    const changed = locationChanged || LEDGER_FIELDS.some((f) => String(farm[f] ?? "") !== before[f]);
    if (changed) {
      await SolarData.deleteMany({ farmId: farm._id, source: "model" });
      await CarbonTransaction.deleteMany({ farmId: farm._id, sourceDay: { $type: "string" } });
      ledger.invalidate(farm._id);
      await ledger.ensureLedger(farm, { force: true }).catch((e) => console.error("ledger:", e.message));
    }
    res.json({ success: true, data: farm });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message || "Could not update farm" });
  }
};

// @route PUT /api/farm/me  — name, phone, language
exports.updateMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  for (const f of ["name", "phone", "language"]) if (req.body[f] !== undefined) user[f] = req.body[f];
  await user.save();
  const out = user.toObject();
  delete out.password;
  res.json({ success: true, data: out });
};

// @route GET /api/farm/geocode?q=Khordha, Odisha   (forward geocode for the settings form)
exports.geocode = async (req, res) => {
  try {
    const q = String(req.query.q || "").slice(0, 120);
    if (!q) return res.json({ success: true, data: [] });
    const { data } = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q, format: "json", limit: 5, countrycodes: "in", addressdetails: 1 },
      headers: { "User-Agent": "AgroVolt-AI/1.0 (agrovolt-ai.vercel.app)" },
      timeout: 8000,
    });
    res.json({
      success: true,
      data: data.map((r) => ({
        label: r.display_name,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        district: r.address?.state_district || r.address?.county || r.address?.city || "",
        state: r.address?.state || "",
      })),
    });
  } catch (e) {
    res.status(502).json({ success: false, message: "Geocoding unavailable" });
  }
};
