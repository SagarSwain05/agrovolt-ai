const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const Crop = require("../models/Crop");
const CarbonTransaction = require("../models/CarbonTransaction");

// @desc    Get dashboard data
// @route   GET /api/dashboard
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const farm = await Farm.findOne({ userId });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found. Please complete your profile."
      });
    }

    // Get solar data for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const solarData = await SolarData.find({
      farmId: farm._id,
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: -1 });

    // Calculate solar income
    const totalSolarEnergy = solarData.reduce((sum, data) => sum + data.energyProduced, 0);
    const solarIncome = totalSolarEnergy * 6; // ₹6 per kWh average

    // Get crop data
    const crops = await Crop.find({ farmId: farm._id, status: { $ne: "harvested" } });
    
    // Estimate crop income (simplified)
    const cropIncome = crops.reduce((sum, crop) => {
      return sum + (crop.predictedYield * 2000); // ₹2000 per quintal average
    }, 0);

    // Get carbon credits
    const carbonTransactions = await CarbonTransaction.find({
      farmId: farm._id,
      transactionType: "earned"
    });

    const totalCarbonCredits = carbonTransactions.reduce(
      (sum, tx) => sum + tx.creditsEarned,
      0
    );

    const totalWaterSaved = carbonTransactions.reduce(
      (sum, tx) => sum + tx.waterSavedLiters,
      0
    );

    const totalCO2Reduced = carbonTransactions.reduce(
      (sum, tx) => sum + tx.co2ReducedKg,
      0
    );

    // AI Advisory (mock for pilot)
    const advisory = {
      irrigation: "Optimal irrigation time: 6:00 AM - 8:00 AM for maximum cooling effect",
      solar: farm.solarInstalled ? "Panel efficiency at 87%. Cleaning recommended in 3 days." : "Consider installing solar panels for dual income",
      crop: crops.length > 0 ? `${crops[0].cropName} health score: ${crops[0].healthScore}%` : "No active crops. Consider planting shade-tolerant crops.",
      risk: "Low pest risk. Weather favorable for next 7 days."
    };

    res.json({
      success: true,
      data: {
        farm: {
          name: farm.farmName,
          size: farm.farmSize,
          healthScore: farm.healthScore,
          location: farm.location
        },
        income: {
          solar: Math.round(solarIncome),
          crop: Math.round(cropIncome),
          total: Math.round(solarIncome + cropIncome)
        },
        solar: {
          installed: farm.solarInstalled,
          capacity: farm.solarCapacityKW,
          energyProduced: Math.round(totalSolarEnergy),
          efficiency: solarData.length > 0 ? solarData[0].efficiency : 0,
          recentData: solarData.slice(0, 7) // Last 7 days
        },
        crops: {
          active: crops.length,
          list: crops
        },
        carbon: {
          credits: Math.round(totalCarbonCredits * 100) / 100,
          waterSaved: Math.round(totalWaterSaved),
          co2Reduced: Math.round(totalCO2Reduced * 100) / 100,
          monetaryValue: Math.round(totalCarbonCredits * 1500) // ₹1500 per credit
        },
        advisory,
        weather: {
          temp: 28,
          humidity: 65,
          rainfall: 0,
          forecast: "Sunny"
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
