const MarketData = require("../models/MarketData");
const Farm = require("../models/Farm");
const priceForecaster = require("../mlModels/priceForecaster");
const agmarknet = require("../services/agmarknetLive");
const { haversineKm, geocodeMandi } = require("../services/geo");

/**
 * Live mandi prices for the farm's state with net-of-transport ranking.
 * Returns null when the live feed is unreachable or has no records.
 */
async function liveMandiPrices(crop, farm) {
  try {
    const live = await agmarknet.getLive(crop, farm.location?.state || "Odisha");
    if (!live.records.length) return null;
    const byMarket = new Map();
    for (const r of live.records) {
      const prev = byMarket.get(r.market);
      if (!prev || new Date(prev.arrival_date.split("/").reverse().join("-")) < new Date(r.arrival_date.split("/").reverse().join("-"))) byMarket.set(r.market, r);
    }
    const rate = priceForecaster.transportCostPerKmQ;
    const rows = [];
    let geocoded = 0;
    for (const r of byMarket.values()) {
      let km = null;
      const loc = await geocodeMandi(r.market, r.district, r.state, geocoded < 6);
      if (loc?.fresh) geocoded++;
      if (loc && farm.location?.latitude) km = Math.round(haversineKm(farm.location.latitude, farm.location.longitude, loc.lat, loc.lon) * 1.25); // road factor
      const price = Number(r.modal_price);
      const transportCost = km != null ? Math.round(km * rate) : null;
      rows.push({
        mandi: r.market, district: r.district, state: r.state, type: "apmc",
        distance_km: km, distance: km != null ? `${km} km` : "—",
        price, minPrice: Number(r.min_price), maxPrice: Number(r.max_price),
        transportCost, netProfit: transportCost != null ? price - transportCost : price,
        trend: "stable", demand: "medium", variety: r.variety,
        lastUpdated: r.arrival_date.split("/").reverse().join("-"), source: "live",
      });
    }
    rows.sort((a, b) => b.netProfit - a.netProfit);
    return { rows: rows.slice(0, 15), scope: live.scope, commodity: live.commodity, fetchedAt: live.fetchedAt };
  } catch (e) {
    console.error("[market] live feed unavailable:", e.message);
    return null;
  }
}

// @desc    Get market prices with net arbitrage
// @route   GET /api/market/prices
// @access  Private
exports.getMarketPrices = async (req, res) => {
  try {
    const { cropName } = req.query;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const district = farm.location?.district || "Khordha";
    const crop = cropName || "Tomato";

    const live = await liveMandiPrices(crop, farm);
    const crowd = live ? [] : await crowdPrices(crop, farm);
    const prices = live ? live.rows : [...crowd, ...priceForecaster.getMandiPrices(crop, district)].sort((a, b) => b.netProfit - a.netProfit);

    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const bestNetProfit = prices[0]?.netProfit || 0;
    const bestMandi = prices[0]?.mandi || "Khordha Mandi";

    res.json({
      success: true,
      data: {
        crop,
        prices,
        source: live ? "live" : crowd.length ? "crowd" : "snapshot",
        sourceLabel: live ? `Agmarknet live · ${live.scope}` : crowd.length ? "Farmer/FPO reports + Agmarknet snapshot" : "Agmarknet snapshot (offline fallback)",
        feedStatus: agmarknet.status(),
        fetchedAt: live?.fetchedAt || null,
        analysis: {
          avgPrice: Math.round(avgPrice),
          bestPrice: prices[0]?.price || 0,
          bestMandi,
          bestNetProfit,
          transportCostRate: priceForecaster.transportCostPerKmQ,
          recommendation: `Best net profit at ${bestMandi} (₹${bestNetProfit}/q after transport)`
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Median of farmer/FPO reports per mandi over the last 3 days. */
async function crowdPrices(crop, farm) {
  const PriceReport = require("../models/PriceReport");
  const rows = await PriceReport.find({ crop, state: farm.location?.state || "Odisha", date: { $gte: new Date(Date.now() - 3 * 86400e3) } }).lean();
  const by = {};
  for (const r of rows) (by[r.mandi] ||= []).push(r);
  const rate = priceForecaster.transportCostPerKmQ;
  const out = [];
  for (const [mandi, list] of Object.entries(by)) {
    const p = list.map((x) => x.price).sort((a, b) => a - b);
    const price = p[Math.floor(p.length / 2)];
    const loc = await geocodeMandi(mandi, list[0].district || "", list[0].state || "", true).catch(() => null);
    const km = loc && farm.location?.latitude ? Math.round(haversineKm(farm.location.latitude, farm.location.longitude, loc.lat, loc.lon) * 1.25) : null;
    const transportCost = km != null ? Math.round(km * rate) : null;
    out.push({
      mandi, district: list[0].district, type: "reported", distance_km: km, distance: km != null ? `${km} km` : "—", price,
      transportCost, netProfit: transportCost != null ? price - transportCost : price, trend: "stable", demand: "medium",
      lastUpdated: list.map((x) => x.date).sort().pop(), source: "crowd", reports: list.length,
      verified: list.some((x) => x.role === "fpo" || x.role === "admin"),
    });
  }
  return out;
}

// @desc    Report today's price at a mandi (farmer / FPO)
// @route   POST /api/market/report
exports.reportPrice = async (req, res) => {
  try {
    const PriceReport = require("../models/PriceReport");
    const { crop, mandi, price, soldQty } = req.body || {};
    if (!crop || !mandi || !(Number(price) > 0)) return res.status(400).json({ success: false, message: "crop, mandi and price are required" });
    const farm = await Farm.findOne({ userId: req.user._id }).lean();
    const recent = await PriceReport.countDocuments({ userId: req.user._id, date: { $gte: new Date(Date.now() - 86400e3) } });
    if (recent >= 20) return res.status(429).json({ success: false, message: "Daily report limit reached" });
    const doc = await PriceReport.create({
      userId: req.user._id, role: req.user.role, crop, mandi: String(mandi).slice(0, 80), price: Number(price), soldQty: Number(soldQty) || undefined,
      district: req.body.district || farm?.location?.district, state: req.body.state || farm?.location?.state || "Odisha",
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, message: e.message });
  }
};

// @desc    Market data-source health
// @route   GET /api/market/status
exports.getStatus = async (req, res) => {
  const PriceReport = require("../models/PriceReport");
  res.json({
    success: true,
    data: {
      agmarknet: agmarknet.status(),
      scheduler: require("../services/scheduler").state().market,
      crowdReports7d: await PriceReport.countDocuments({ date: { $gte: new Date(Date.now() - 7 * 86400e3) } }),
      snapshotAsOf: priceForecaster.getDailyHistory("Tomato").slice(-1)[0]?.date || null,
    },
  });
};

// @desc    Get price trends (historical + forecast)
// @route   GET /api/market/trends
// @access  Private
exports.getPriceTrends = async (req, res) => {
  try {
    const { cropName } = req.query;
    const crop = cropName || "Tomato";

    const farm = await Farm.findOne({ userId: req.user._id });
    const daily = await agmarknet.getHistory(crop, farm?.location?.state).catch(() => []);
    const result = priceForecaster.forecast(crop, 14, { daily });
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      data: {
        crop,
        history: result.history,
        forecast: result.forecast,
        signal: result.signal,
        confidence: result.confidence,
        pctChange: result.pctChange,
        recommendation: result.recommendation,
        upcomingEvents: result.upcomingEvents,
        algorithm: result.algorithm,
        dataSource: result.dataSource,
        isLive: result.isLive,
        asOf: result.asOf,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get selling recommendation
// @route   GET /api/market/recommend
// @access  Private
exports.getSellingRecommendation = async (req, res) => {
  try {
    const { cropName, quantity } = req.query;
    const crop = cropName || "Tomato";
    const qty = parseInt(quantity) || 10;

    const intel = priceForecaster.getFullIntelligence(crop);
    if (intel.error) {
      return res.status(400).json({ success: false, message: intel.error });
    }

    res.json({
      success: true,
      data: {
        crop,
        quantity: qty,
        current: {
          price: intel.currentPrice,
          revenue: intel.currentPrice * qty,
          timing: "Immediate"
        },
        projected: {
          price: intel.forecast[Math.min(6, intel.forecast.length - 1)]?.price || intel.currentPrice,
          revenue: intel.projectedRevenue,
          timing: `${intel.waitDays} days`,
          gain: intel.revenueDifference
        },
        recommendation: {
          action: intel.signal,
          waitDays: intel.waitDays,
          reason: intel.recommendation,
          confidence: `${intel.confidence}%`,
          riskFactor: intel.pctChange > 5 ? "Medium" : "Low"
        },
        bestMandi: {
          name: intel.bestMandi,
          netProfit: intel.bestNetProfit,
        },
        upcomingEvents: intel.upcomingEvents,
        msp: intel.msp,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
