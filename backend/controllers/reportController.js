const Farm = require("../models/Farm");
const DiseaseScan = require("../models/DiseaseScan");
const SolarData = require("../models/SolarData");
const weather = require("../services/weatherService");
const ledger = require("../services/energyLedger");
const cropRecommender = require("../mlModels/cropRecommender");
const priceForecaster = require("../mlModels/priceForecaster");
const { currentSeason } = require("../services/assistantFallback");

const MARKET = ["Tomato", "Turmeric", "Rice", "Wheat", "Millet", "Groundnut", "Soybean"];
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// @desc  Season intelligence report built from live/observed data
// @route GET /api/reports/season
exports.season = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    const { latitude: lat, longitude: lon } = farm.location;
    await ledger.ensureLedger(farm).catch(() => {});

    const om = await weather.getOpenMeteo(lat, lon, 92);
    const today = om.current.time.slice(0, 10);
    const d = om.daily;
    const past = d.time.map((t, i) => ({ t, i })).filter((x) => x.t < today);
    const next = d.time.map((t, i) => ({ t, i })).filter((x) => x.t >= today);
    const pick = (arr, k) => arr.map((x) => d[k][x.i]).filter((v) => v != null);

    const rain90 = pick(past, "precipitation_sum").reduce((s, v) => s + v, 0);
    const tmax90 = pick(past, "temperature_2m_max");
    const heatDays = tmax90.filter((v) => v >= 38).length;
    const dryStreak = (() => { let n = 0, best = 0; for (const v of pick(past, "precipitation_sum")) { n = v < 1 ? n + 1 : 0; best = Math.max(best, n); } return best; })();
    const rad90 = pick(past, "shortwave_radiation_sum").map((v) => v / 3.6);
    const et090 = pick(past, "et0_fao_evapotranspiration").reduce((s, v) => s + v, 0);

    const season = currentSeason();
    const recs = cropRecommender.recommend({
      soilType: farm.soilType || "loamy", rainfall: farm.annualRainfall || 1450, season, district: farm.location.district,
      shadowCoverage: farm.solarInstalled ? farm.shadeCoverage : 0, shadeFactor: farm.solarInstalled ? (farm.shadeCoverage || 0) / 100 : 0,
      temperature: Math.round(mean(tmax90) || 30), humidity: om.current.relative_humidity_2m,
    });
    const top = (recs.recommendations || []).slice(0, 5).map((c) => {
      const m = MARKET.find((x) => x.toLowerCase() === String(c.name).toLowerCase());
      let market = null;
      if (m) { try { const f = priceForecaster.forecast(m, 14); market = { price: f.currentPrice, pctChange: f.pctChange, signal: f.signal, asOf: f.asOf }; } catch { /* untracked */ } }
      return { name: c.name, confidence: Math.round(c.confidence * 100), reasons: c.reasons || c.factors || null, market };
    });

    const since90 = new Date(Date.now() - 92 * 86400000);
    const [scans, solar] = await Promise.all([
      DiseaseScan.find({ farmId: farm._id, scannedAt: { $gte: since90 } }).lean(),
      SolarData.find({ farmId: farm._id, date: { $gte: since90 } }).lean(),
    ]);
    const diseases = {};
    scans.filter((s) => !/healthy/i.test(s.detectedDisease)).forEach((s) => { diseases[s.detectedDisease] = (diseases[s.detectedDisease] || 0) + 1; });

    // Risk flags (codes; the client renders them in the user's language)
    const risks = [];
    if (heatDays >= 5) risks.push({ code: "heat", level: heatDays >= 15 ? "high" : "medium", value: heatDays });
    if (dryStreak >= 14) risks.push({ code: "dry_spell", level: dryStreak >= 21 ? "high" : "medium", value: dryStreak });
    if (rain90 < et090 * 0.5) risks.push({ code: "water_deficit", level: "medium", value: Math.round(et090 - rain90) });
    const nextRain = pick(next, "precipitation_sum").reduce((s, v) => s + v, 0);
    if (nextRain > 100) risks.push({ code: "heavy_rain", level: "high", value: Math.round(nextRain) });
    if (Object.keys(diseases).length) risks.push({ code: "disease", level: "medium", value: Object.values(diseases).reduce((s, v) => s + v, 0) });

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        season, farm: { name: farm.farmName, district: farm.location.district, state: farm.location.state, soil: farm.soilType, sizeAcres: farm.farmSize },
        climate: {
          periodDays: past.length,
          rainfallMm: Math.round(rain90), et0Mm: Math.round(et090), avgTmax: r1(mean(tmax90)), maxTmax: r1(Math.max(...tmax90)),
          heatDays, longestDrySpell: dryStreak, avgSunKwhM2: r1(mean(rad90)),
          next7: { rainMm: Math.round(nextRain), tmax: Math.max(...pick(next, "temperature_2m_max")) },
          source: "Open-Meteo (observed reanalysis + forecast)",
        },
        risks,
        crops: top,
        solar: farm.solarInstalled ? {
          days: solar.length, kwh: r1(solar.reduce((s, x) => s + x.energyProduced, 0)), revenue: Math.round(solar.reduce((s, x) => s + (x.revenue || 0), 0)),
          waterSavedL: Math.round(solar.reduce((s, x) => s + (x.waterSavedLiters || 0), 0)), co2Kg: Math.round(solar.reduce((s, x) => s + (x.co2AvoidedKg || 0), 0)),
        } : null,
        diseases: Object.entries(diseases).map(([name, count]) => ({ name, count })),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not build report" });
  }
};
