const { buildContext, renderActions } = require("../services/farmContext");
const i18n = require("../services/i18n");

// @desc    Live dashboard: weather, sensors, solar ledger, carbon, market, actions
// @route   GET /api/dashboard?lang=en|hi|or
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const lang = i18n.normLang(req.query.lang || req.user.language);
    const ctx = await buildContext(req.user);
    if (!ctx) {
      return res.status(404).json({ success: false, message: "Farm not found. Please complete your profile." });
    }
    const solarIncome30 = ctx.solar?.last30.revenue || 0;
    res.json({
      success: true,
      data: {
        ...ctx,
        actions: renderActions(ctx.actions, lang),
        income: {
          solar30: solarIncome30,
          carbonValue: ctx.carbon.valueInr,
          todaySolar: ctx.solar ? Math.round(ctx.solar.todayKwh * ctx.solar.tariffPerKwh) : 0,
          total30: solarIncome30 + ctx.carbon.valueInr,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Dual-income (solar + crop + carbon) breakdown
// @route   GET /api/dashboard/profit
// @access  Private
exports.getProfit = async (req, res) => {
  try {
    const Farm = require("../models/Farm");
    const Crop = require("../models/Crop");
    const SolarData = require("../models/SolarData");
    const CarbonTransaction = require("../models/CarbonTransaction");
    const ledger = require("../services/energyLedger");
    const priceForecaster = require("../mlModels/priceForecaster");
    const yields = require("../data/crop_yields_india.json");
    const physics = require("../services/agrivoltaicPhysics");

    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    await ledger.ensureLedger(farm).catch(() => {});

    const [monthly, crops, carbon] = await Promise.all([
      SolarData.aggregate([
        { $match: { farmId: farm._id } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, kwh: { $sum: "$energyProduced" }, revenue: { $sum: "$revenue" }, days: { $sum: 1 }, water: { $sum: "$waterSavedLiters" } } },
        { $sort: { _id: 1 } },
      ]),
      Crop.find({ farmId: farm._id, status: { $ne: "harvested" } }).lean(),
      CarbonTransaction.find({ farmId: farm._id }).lean(),
    ]);

    const areaHa = (farm.farmSize || 1) * 0.4047;
    const shadePenalty = 1 - 0.25 * ((farm.shadeCoverage ?? 35) / 100); // shade-tolerant crops lose ≤25% under full shade
    const cropIncome = crops.map((c) => {
      const ref = yields.find((y) => y.crop.toLowerCase() === String(c.cropName).toLowerCase());
      const lastYield = ref?.years?.[ref.years.length - 1]?.yield_kg_ha;
      const estQ = c.predictedYield > 0 ? c.predictedYield : lastYield ? (lastYield * areaHa * shadePenalty) / 100 : null;
      let price = null;
      try { price = priceForecaster.forecast(c.cropName, 7).currentPrice || null; } catch { /* crop not tracked */ }
      return {
        id: c._id, crop: c.cropName, season: c.season, status: c.status, harvest: c.expectedHarvestDate,
        yieldQuintal: estQ != null ? Math.round(estQ * 10) / 10 : null, yieldSource: c.predictedYield > 0 ? "farmer" : lastYield ? "district-average" : null,
        pricePerQuintal: price, revenue: estQ != null && price ? Math.round(estQ * price) : null,
      };
    });

    const earned = carbon.filter((t) => t.transactionType === "earned");
    const sold = carbon.filter((t) => t.transactionType === "withdrawn");
    const solarDays = monthly.reduce((s, m) => s + m.days, 0);
    const solarKwh = monthly.reduce((s, m) => s + m.kwh, 0);
    const kwhPerKwDay = farm.solarCapacityKW > 0 && solarDays ? solarKwh / solarDays / farm.solarCapacityKW : 4;

    res.json({
      success: true,
      data: {
        tariffPerKwh: farm.tariffPerKwh,
        capacityKW: farm.solarCapacityKW,
        solarInstalled: farm.solarInstalled,
        kwhPerKwDay: Math.round(kwhPerKwDay * 100) / 100,
        monthly: monthly.map((m) => ({ month: m._id, kwh: Math.round(m.kwh * 10) / 10, revenue: Math.round(m.revenue), days: m.days, water: Math.round(m.water) })),
        solar: { kwh: Math.round(solarKwh * 10) / 10, revenue: Math.round(monthly.reduce((s, m) => s + m.revenue, 0)), days: solarDays },
        carbon: {
          earnedCredits: Math.round(earned.reduce((s, t) => s + t.creditsEarned, 0) * 1000) / 1000,
          soldInr: Math.round(sold.reduce((s, t) => s + (t.monetaryValue || 0), 0)),
          unsoldValueInr: Math.round(Math.max(0, earned.reduce((s, t) => s + t.creditsEarned, 0) - sold.reduce((s, t) => s + t.creditsEarned, 0)) * physics.CREDIT_PRICE_INR),
        },
        crops: cropIncome,
        areaHa: Math.round(areaHa * 100) / 100,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
