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
    const prices = live ? live.rows : priceForecaster.getMandiPrices(crop, district);

    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const bestNetProfit = prices[0]?.netProfit || 0;
    const bestMandi = prices[0]?.mandi || "Khordha Mandi";

    res.json({
      success: true,
      data: {
        crop,
        prices,
        source: live ? "live" : "snapshot",
        sourceLabel: live ? `Agmarknet live · ${live.scope}` : "Agmarknet snapshot (offline fallback)",
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
