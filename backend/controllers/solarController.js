const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const solarPosition = require("../mlModels/solarPosition");
const ledger = require("../services/energyLedger");
const weather = require("../services/weatherService");

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

    await ledger.ensureLedger(farm).catch((e) => console.error("ledger:", e.message));

    // NREL Solar Position Analysis, with bio-cooling at today's real max temperature
    const crop = farm.cropUnderPanels || 'general';
    const analysis = solarPosition.analyze(latitude, longitude, currentTilt, capacity, crop);
    try {
      const fc = await weather.getForecast(latitude, longitude);
      const tmax = fc.forecast[0]?.tempMax;
      if (tmax != null) analysis.bioCooling = solarPosition.bioCoolingEffect(tmax, crop, farm.shadeCoverage ?? 35);
      analysis.peakSunHoursToday = fc.forecast[0]?.radiationKwhM2;
      // Hourly AC power today and daily generation forecast from real irradiance
      const physics = require("../services/agrivoltaicPhysics");
      const om = await weather.getOpenMeteo(latitude, longitude);
      const today = om.current.time.slice(0, 10);
      const tf = physics.tiltFactor(currentTilt, analysis.optimalTilt);
      analysis.hourlyToday = om.hourly.time
        .map((ts, i) => ({ ts, G: om.hourly.shortwave_radiation[i] || 0, T: om.hourly.temperature_2m[i] }))
        .filter((h) => h.ts.startsWith(today))
        .map((h) => {
          const pt = physics.panelTemperature(h.T, h.G, crop, farm.shadeCoverage ?? 35);
          return {
            hour: Number(h.ts.slice(11, 13)),
            irradiance: Math.round(h.G),
            powerW: Math.round(physics.instantPowerW({ capacityKW: capacity, irradianceWm2: h.G, panelTempC: pt.cooled, tiltFactor: tf })),
            panelTempC: Math.round(pt.cooled * 10) / 10,
          };
        });
      analysis.currentHour = Number(om.current.time.slice(11, 13));
      analysis.forecast7 = fc.forecast.map((f) => {
        const e = physics.dailyEnergy({ capacityKW: capacity, peakSunHours: f.radiationKwhM2, tempMaxC: f.tempMax, crop, shadeCoveragePct: farm.shadeCoverage ?? 35, tiltFactor: tf, et0Mm: f.et0 || 4 });
        return { date: f.date, kwh: Math.round(e.energyKwh * 10) / 10, revenue: Math.round(e.energyKwh * (farm.tariffPerKwh || 6)), radiation: f.radiationKwhM2, tempMax: f.tempMax, description: f.description };
      });
    } catch (e) { console.error("solar weather:", e.message); }

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
        hourlyToday: analysis.hourlyToday || [],
        currentHour: analysis.currentHour,
        forecast7: analysis.forecast7 || [],
        peakSunHoursToday: analysis.peakSunHoursToday,
        shadeCoverage: farm.shadeCoverage,
        cropUnderPanels: crop,
        tariffPerKwh: farm.tariffPerKwh,
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

    await ledger.ensureLedger(farm).catch((e) => console.error("ledger:", e.message));

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
