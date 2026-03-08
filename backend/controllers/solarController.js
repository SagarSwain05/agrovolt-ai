const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const solarPosition = require("../mlModels/solarPosition");

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

    const { latitude, longitude } = farm.location;
    const currentTilt = farm.panelTilt || 20;
    const capacity = farm.solarCapacityKW || 5;

    // NREL Solar Position Analysis
    const analysis = solarPosition.analyze(latitude, longitude, currentTilt, capacity, 'ginger');

    // Get recent solar data
    const recentData = await SolarData.find({ farmId: farm._id })
      .sort({ date: -1 })
      .limit(30);

    const avgEfficiency = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.efficiency, 0) / recentData.length
      : 85;

    const avgEnergy = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.energyProduced, 0) / recentData.length
      : analysis.energyEstimate.currentDaily;

    res.json({
      success: true,
      data: {
        current: {
          tilt: currentTilt,
          efficiency: Math.round(avgEfficiency * 10) / 10,
          dailyEnergy: Math.round(avgEnergy * 10) / 10,
          panelCount: farm.panelCount,
          capacity: capacity
        },
        optimal: {
          tilt: analysis.optimalTilt,
          potentialGain: analysis.efficiencyGain,
          projectedEnergy: analysis.energyEstimate.optimizedDaily
        },
        sunPath: analysis.sunPath,
        bioCooling: analysis.bioCooling,
        energyEstimate: analysis.energyEstimate,
        sunrise: analysis.sunrise,
        sunset: analysis.sunset,
        recommendations: {
          tiltAdjustment: analysis.tiltDifference > 3
            ? `Adjust tilt to ${analysis.optimalTilt}° for ${analysis.efficiencyGain} efficiency gain`
            : "Current tilt is near optimal",
          cleaning: avgEfficiency < 80 ? "Panel cleaning recommended - efficiency below 80%" : "Panel condition good",
          cooling: `Crop transpiration reduces panel temp by ${analysis.bioCooling.temperatureReduction}°C, boosting efficiency by ${analysis.bioCooling.efficiencyGain}%`
        },
        algorithm: "NREL Solar Position Algorithm (Simplified)",
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
