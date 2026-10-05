const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const CarbonTransaction = require("../models/CarbonTransaction");
const DiseaseScan = require("../models/DiseaseScan");
const Telemetry = require("../models/Telemetry");

const OUTBREAK_MIN_FARMS = 3;

// @desc    District / state aggregate for FPOs & agriculture departments (anonymised)
// @route   GET /api/district?district=Khordha&state=Odisha
// @access  Private
exports.getDistrict = async (req, res) => {
  try {
    const own = await Farm.findOne({ userId: req.user._id }).lean();
    const district = req.query.district ?? own?.location?.district ?? "";
    const state = req.query.state ?? own?.location?.state ?? "Odisha";

    const farmFilter = { "location.state": state };
    if (district) farmFilter["location.district"] = district;
    const farms = await Farm.find(farmFilter).select("_id farmSize solarInstalled solarCapacityKW location.district cropUnderPanels").lean();
    const ids = farms.map((f) => f._id);

    const since30 = new Date(Date.now() - 30 * 86400000);
    const since14 = new Date(Date.now() - 14 * 86400000);
    const [energy, carbon, scans, devices, districts] = await Promise.all([
      SolarData.aggregate([
        { $match: { farmId: { $in: ids }, date: { $gte: since30 } } },
        { $group: { _id: "$day", kwh: { $sum: "$energyProduced" }, water: { $sum: "$waterSavedLiters" }, cool: { $sum: "$bioCoolingGainKwh" }, co2: { $sum: "$co2AvoidedKg" } } },
        { $sort: { _id: 1 } },
      ]),
      CarbonTransaction.aggregate([
        { $match: { farmId: { $in: ids }, transactionType: "earned" } },
        { $group: { _id: null, credits: { $sum: "$creditsEarned" }, co2: { $sum: "$co2ReducedKg" }, water: { $sum: "$waterSavedLiters" } } },
      ]),
      DiseaseScan.aggregate([
        { $match: { farmId: { $in: ids }, scannedAt: { $gte: since14 }, detectedDisease: { $not: /healthy/i } } },
        { $lookup: { from: "farms", localField: "farmId", foreignField: "_id", as: "farm" } },
        { $unwind: "$farm" },
        { $group: {
          _id: { disease: "$detectedDisease", crop: "$cropName" },
          scans: { $sum: 1 }, farms: { $addToSet: "$farmId" }, avgConfidence: { $avg: "$confidenceScore" },
          districts: { $addToSet: "$farm.location.district" }, last: { $max: "$scannedAt" },
          severe: { $sum: { $cond: [{ $in: ["$severity", ["high", "critical"]] }, 1, 0] } },
        } },
        { $sort: { scans: -1 } },
      ]),
      Telemetry.distinct("farmId", { farmId: { $in: ids }, source: "device", ts: { $gte: new Date(Date.now() - 86400000) } }),
      Farm.aggregate([
        { $match: { "location.state": state } },
        { $group: { _id: "$location.district", farms: { $sum: 1 } } },
        { $sort: { farms: -1 } },
      ]),
    ]);

    const kwh30 = energy.reduce((s, d) => s + d.kwh, 0);
    const cool30 = energy.reduce((s, d) => s + d.cool, 0);
    const outbreaks = scans.map((s) => ({
      disease: s._id.disease, crop: s._id.crop, scans: s.scans, farmsAffected: s.farms.length,
      districts: s.districts.filter(Boolean), avgConfidence: Math.round(s.avgConfidence), severeCases: s.severe, lastSeen: s.last,
      alert: s.farms.length >= OUTBREAK_MIN_FARMS ? "outbreak" : s.severe > 0 ? "watch" : "isolated",
    }));

    res.json({
      success: true,
      data: {
        scope: { district: district || null, state },
        districts: districts.filter((d) => d._id).map((d) => ({ name: d._id, farms: d.farms })),
        farms: {
          total: farms.length,
          withSolar: farms.filter((f) => f.solarInstalled).length,
          areaAcres: Math.round(farms.reduce((s, f) => s + (f.farmSize || 0), 0) * 10) / 10,
          capacityKW: Math.round(farms.reduce((s, f) => s + (f.solarInstalled ? f.solarCapacityKW || 0 : 0), 0) * 10) / 10,
          withIoT: devices.length,
        },
        last30: {
          energyKwh: Math.round(kwh30),
          waterSavedL: Math.round(energy.reduce((s, d) => s + d.water, 0)),
          co2AvoidedKg: Math.round(energy.reduce((s, d) => s + d.co2, 0)),
          bioCoolingGainPct: kwh30 ? Math.round((cool30 / (kwh30 - cool30)) * 1000) / 10 : 0,
          daily: energy.map((d) => ({ day: d._id, kwh: Math.round(d.kwh * 10) / 10, water: Math.round(d.water) })),
        },
        carbon: {
          credits: Math.round((carbon[0]?.credits || 0) * 1000) / 1000,
          co2Kg: Math.round(carbon[0]?.co2 || 0),
          waterL: Math.round(carbon[0]?.water || 0),
        },
        outbreaks,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
