const Farm = require("../models/Farm");
const Crop = require("../models/Crop");
const cropRecommender = require("../mlModels/cropRecommender");
const axios = require("axios");

// @desc    Get crop recommendations
// @route   POST /api/crop/recommend
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const { soilType, rainfall, season } = req.body;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({ success: false, message: "Farm not found" });
    }

    // Default location (Bhubaneswar)
    const lat = farm.location?.lat || 20.29;
    const lon = farm.location?.lon || 85.82;

    // ═══ PARALLEL DATA ENRICHMENT ═══
    let liveWeather = { temperature: 30, humidity: 60 };
    let solarIrradiance = 4.5; // kWh/m²/day default

    try {
      const [weatherRes, nasaRes] = await Promise.allSettled([
        // 1. OpenWeatherMap — Real-time temperature & humidity
        axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
          params: { lat, lon, appid: process.env.OPENWEATHER_API_KEY, units: 'metric' },
          timeout: 5000
        }),
        // 2. NASA POWER — 30-year avg solar irradiance (ALLSKY_SFC_SW_DWN)
        axios.get(`https://power.larc.nasa.gov/api/temporal/climatology/point`, {
          params: {
            parameters: 'ALLSKY_SFC_SW_DWN',
            community: 'AG',
            longitude: lon,
            latitude: lat,
            format: 'JSON'
          },
          timeout: 8000
        })
      ]);

      if (weatherRes.status === 'fulfilled') {
        const w = weatherRes.value.data;
        liveWeather = { temperature: Math.round(w.main.temp), humidity: w.main.humidity };
      }

      if (nasaRes.status === 'fulfilled') {
        const params = nasaRes.value.data?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
        if (params && params.ANN) {
          solarIrradiance = parseFloat(params.ANN.toFixed(2));
        }
      }
    } catch (enrichErr) {
      console.log("Data enrichment partially failed, using defaults:", enrichErr.message);
    }

    // ═══ DYNAMIC SHADE FACTOR ═══
    const panelCoverage = farm.solarInstalled ? 0.40 : 0.0; // 40% default coverage
    const globalAvgIrradiance = 4.5; // kWh/m²/day world average
    const shadeFactor = panelCoverage * (solarIrradiance / globalAvgIrradiance);

    const conditions = {
      soilType: soilType || farm.soilType || 'loamy',
      rainfall: rainfall || 600,
      season: season || 'kharif',
      district: farm.location?.district || 'Khordha',
      shadowCoverage: Math.round(shadeFactor * 100) || 40,
      temperature: liveWeather.temperature,
      humidity: liveWeather.humidity,
      solarIrradiance,
      shadeFactor: parseFloat(shadeFactor.toFixed(3)),
    };

    const result = cropRecommender.recommend(conditions);

    res.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        topPick: result.topPick,
        excluded: result.excluded,
        modelVersion: result.modelVersion,
        algorithm: result.algorithm,
        liveEnrichment: {
          temperature: liveWeather.temperature,
          humidity: liveWeather.humidity,
          solarIrradiance,
          shadeFactor: parseFloat(shadeFactor.toFixed(3)),
          location: { lat, lon },
        },
        farmDetails: {
          soilType: conditions.soilType,
          size: farm.farmSize,
          solarInstalled: farm.solarInstalled
        },
        advisory: {
          irrigation: "Irrigate during early morning (6-8 AM) for maximum cooling effect on solar panels",
          spacing: "Maintain 3-4 meter spacing under solar panels for optimal sunlight",
          rotation: "Consider crop rotation every season for soil health"
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// @desc    Add new crop
// @route   POST /api/crop
// @access  Private
exports.addCrop = async (req, res) => {
  try {
    const { cropName, season, sowingDate, expectedHarvestDate, predictedYield } = req.body;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const crop = await Crop.create({
      farmId: farm._id,
      cropName,
      season,
      sowingDate,
      expectedHarvestDate,
      predictedYield: predictedYield || 0,
      status: "sown"
    });

    res.status(201).json({
      success: true,
      message: "Crop added successfully",
      data: crop
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get all crops
// @route   GET /api/crop
// @access  Private
exports.getCrops = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const crops = await Crop.find({ farmId: farm._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: crops
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Update crop
// @route   PUT /api/crop/:id
// @access  Private
exports.updateCrop = async (req, res) => {
  try {
    const crop = await Crop.findById(req.params.id);

    if (!crop) {
      return res.status(404).json({
        success: false,
        message: "Crop not found"
      });
    }

    const updatedCrop = await Crop.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Crop updated successfully",
      data: updatedCrop
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
