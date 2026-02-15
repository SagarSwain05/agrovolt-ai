const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");

// Calculate optimal tilt angle based on latitude
const calculateOptimalTilt = (latitude, season = "annual") => {
  let tilt;
  
  if (season === "summer") {
    tilt = latitude - 15;
  } else if (season === "winter") {
    tilt = latitude + 15;
  } else {
    tilt = latitude * 0.9; // Annual average
  }
  
  return Math.max(0, Math.min(90, tilt)); // Clamp between 0-90
};

// @desc    Get solar optimization data
// @route   GET /api/solar/optimize
// @access  Private
exports.getSolarOptimization = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    if (!farm.solarInstalled) {
      return res.json({
        success: true,
        message: "Solar panels not installed",
        data: {
          installed: false,
          recommendation: "Install solar panels to generate dual income and optimize with agrivoltaic farming"
        }
      });
    }

    const { latitude } = farm.location;
    const optimalTilt = calculateOptimalTilt(latitude);
    const currentTilt = farm.panelTilt;

    // Calculate efficiency gain potential
    const tiltDifference = Math.abs(optimalTilt - currentTilt);
    const efficiencyGain = Math.max(0, 15 - tiltDifference); // Up to 15% gain

    // Get recent solar data
    const recentData = await SolarData.find({ farmId: farm._id })
      .sort({ date: -1 })
      .limit(30);

    const avgEfficiency = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.efficiency, 0) / recentData.length
      : 85;

    const avgEnergy = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.energyProduced, 0) / recentData.length
      : farm.solarCapacityKW * 4; // 4 hours average

    res.json({
      success: true,
      data: {
        current: {
          tilt: currentTilt,
          efficiency: Math.round(avgEfficiency * 10) / 10,
          dailyEnergy: Math.round(avgEnergy * 10) / 10,
          panelCount: farm.panelCount,
          capacity: farm.solarCapacityKW
        },
        optimal: {
          tilt: Math.round(optimalTilt * 10) / 10,
          potentialGain: Math.round(efficiencyGain * 10) / 10,
          projectedEnergy: Math.round(avgEnergy * (1 + efficiencyGain / 100) * 10) / 10
        },
        recommendations: {
          tiltAdjustment: tiltDifference > 5 ? `Adjust tilt to ${Math.round(optimalTilt)}° for ${Math.round(efficiencyGain)}% efficiency gain` : "Current tilt is optimal",
          cleaning: avgEfficiency < 80 ? "Panel cleaning recommended - efficiency below 80%" : "Panel condition good",
          cooling: "Maintain crop irrigation during peak hours (11 AM - 3 PM) for natural cooling effect"
        },
        forecast: {
          next7Days: [
            { day: "Mon", energy: avgEnergy * 0.95, efficiency: 86 },
            { day: "Tue", energy: avgEnergy * 1.05, efficiency: 88 },
            { day: "Wed", energy: avgEnergy * 1.1, efficiency: 89 },
            { day: "Thu", energy: avgEnergy * 0.9, efficiency: 85 },
            { day: "Fri", energy: avgEnergy * 1.0, efficiency: 87 },
            { day: "Sat", energy: avgEnergy * 1.05, efficiency: 88 },
            { day: "Sun", energy: avgEnergy * 1.08, efficiency: 89 }
          ]
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

// @desc    Add solar data
// @route   POST /api/solar/data
// @access  Private
exports.addSolarData = async (req, res) => {
  try {
    const { energyProduced, efficiency, dustLevel, panelTemperature } = req.body;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const revenue = energyProduced * 6; // ₹6 per kWh

    const solarData = await SolarData.create({
      farmId: farm._id,
      energyProduced,
      efficiency: efficiency || 85,
      dustLevel: dustLevel || "clean",
      panelTemperature: panelTemperature || 25,
      revenue
    });

    res.status(201).json({
      success: true,
      message: "Solar data added successfully",
      data: solarData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get solar data history
// @route   GET /api/solar/history
// @access  Private
exports.getSolarHistory = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const solarData = await SolarData.find({
      farmId: farm._id,
      date: { $gte: startDate }
    }).sort({ date: 1 });

    const totalEnergy = solarData.reduce((sum, d) => sum + d.energyProduced, 0);
    const totalRevenue = solarData.reduce((sum, d) => sum + d.revenue, 0);
    const avgEfficiency = solarData.length > 0
      ? solarData.reduce((sum, d) => sum + d.efficiency, 0) / solarData.length
      : 0;

    res.json({
      success: true,
      data: {
        history: solarData,
        summary: {
          totalEnergy: Math.round(totalEnergy * 10) / 10,
          totalRevenue: Math.round(totalRevenue),
          avgEfficiency: Math.round(avgEfficiency * 10) / 10,
          days: solarData.length
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
