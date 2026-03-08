const MarketData = require("../models/MarketData");
const Farm = require("../models/Farm");
const priceForecaster = require("../mlModels/priceForecaster");

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

    // ML-based mandi price lookup with net arbitrage
    const prices = priceForecaster.getMandiPrices(crop, district);

    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const bestNetProfit = prices[0]?.netProfit || 0;
    const bestMandi = prices[0]?.mandi || "Khordha Mandi";

    res.json({
      success: true,
      data: {
        crop,
        prices,
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

    const result = priceForecaster.forecast(crop, 14);
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
