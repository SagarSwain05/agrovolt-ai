const MarketData = require("../models/MarketData");
const Farm = require("../models/Farm");

// Mock market data (replace with Agmarknet API integration)
const generateMarketData = (cropName, state) => {
  const basePrices = {
    "Tomato": 2500,
    "Rice": 1800,
    "Wheat": 2000,
    "Millet": 1500,
    "Turmeric": 8000,
    "Soybean": 3500,
    "Groundnut": 5000
  };

  const basePrice = basePrices[cropName] || 2000;
  const variation = (Math.random() - 0.5) * 400; // ±200 variation

  return Math.round(basePrice + variation);
};

// @desc    Get market prices
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

    const state = farm.location.state || "Odisha";
    const district = farm.location.district || "Khordha";

    // Get or generate market data for nearby mandis
    const mandis = [
      { name: `${district} Mandi`, distance: 5 },
      { name: "Regional Market", distance: 15 },
      { name: "District Hub", distance: 25 },
      { name: "State Market", distance: 45 },
      { name: "Central Market", distance: 60 }
    ];

    const prices = mandis.map(mandi => ({
      mandi: mandi.name,
      distance: mandi.distance,
      price: generateMarketData(cropName || "Tomato", state),
      trend: Math.random() > 0.5 ? "up" : "down",
      demand: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
      lastUpdated: new Date()
    }));

    // Sort by price (highest first)
    prices.sort((a, b) => b.price - a.price);

    // Calculate best selling window
    const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
    const bestPrice = prices[0].price;
    const priceAdvantage = ((bestPrice - avgPrice) / avgPrice * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        crop: cropName || "Tomato",
        prices,
        analysis: {
          avgPrice: Math.round(avgPrice),
          bestPrice,
          bestMandi: prices[0].mandi,
          priceAdvantage: `${priceAdvantage}%`,
          recommendation: bestPrice > avgPrice * 1.1 
            ? `Sell at ${prices[0].mandi} for ${priceAdvantage}% better price`
            : "Prices are stable across markets"
        },
        forecast: {
          next7Days: "Prices expected to rise by 5-8%",
          next30Days: "Seasonal demand increasing",
          confidence: "Medium"
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get price trends
// @route   GET /api/market/trends
// @access  Private
exports.getPriceTrends = async (req, res) => {
  try {
    const { cropName, days = 30 } = req.query;

    // Generate mock historical data
    const trends = [];
    const basePrice = 2000;
    
    for (let i = parseInt(days); i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const seasonalFactor = Math.sin((i / 30) * Math.PI) * 200;
      const randomFactor = (Math.random() - 0.5) * 100;
      const price = basePrice + seasonalFactor + randomFactor;
      
      trends.push({
        date: date.toISOString().split('T')[0],
        price: Math.round(price),
        volume: Math.round(1000 + Math.random() * 500)
      });
    }

    // Calculate trend direction
    const recentAvg = trends.slice(-7).reduce((sum, t) => sum + t.price, 0) / 7;
    const olderAvg = trends.slice(0, 7).reduce((sum, t) => sum + t.price, 0) / 7;
    const trendDirection = recentAvg > olderAvg ? "increasing" : "decreasing";
    const trendPercentage = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        crop: cropName || "Tomato",
        trends,
        analysis: {
          direction: trendDirection,
          change: `${trendPercentage}%`,
          currentPrice: trends[trends.length - 1].price,
          avgPrice: Math.round(trends.reduce((sum, t) => sum + t.price, 0) / trends.length),
          recommendation: trendDirection === "increasing" 
            ? "Hold for better prices in coming days"
            : "Consider selling soon before prices drop further"
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get selling recommendation
// @route   GET /api/market/recommend
// @access  Private
exports.getSellingRecommendation = async (req, res) => {
  try {
    const { cropName, quantity } = req.query;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const currentPrice = generateMarketData(cropName || "Tomato", farm.location.state);
    const projectedPrice = currentPrice * 1.08; // 8% increase projected
    
    const currentRevenue = currentPrice * (quantity || 10);
    const projectedRevenue = projectedPrice * (quantity || 10);
    const potentialGain = projectedRevenue - currentRevenue;

    res.json({
      success: true,
      data: {
        crop: cropName || "Tomato",
        quantity: quantity || 10,
        current: {
          price: currentPrice,
          revenue: Math.round(currentRevenue),
          timing: "Immediate"
        },
        projected: {
          price: Math.round(projectedPrice),
          revenue: Math.round(projectedRevenue),
          timing: "7-10 days",
          gain: Math.round(potentialGain)
        },
        recommendation: {
          action: potentialGain > currentRevenue * 0.05 ? "Wait" : "Sell Now",
          reason: potentialGain > currentRevenue * 0.05 
            ? `Waiting could earn you ₹${Math.round(potentialGain)} more`
            : "Current prices are optimal",
          confidence: "Medium",
          riskFactor: "Low"
        },
        factors: {
          demand: "High",
          supply: "Medium",
          weather: "Favorable",
          festival: "Upcoming festival may increase demand"
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
