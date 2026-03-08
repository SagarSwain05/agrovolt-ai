const Farm = require("../models/Farm");
const Crop = require("../models/Crop");
const cropRecommender = require("../mlModels/cropRecommender");

// @desc    Get crop recommendations
// @route   POST /api/crop/recommend
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const { soilType, rainfall, season } = req.body;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const conditions = {
      soilType: soilType || farm.soilType || 'loamy',
      rainfall: rainfall || 600,
      season: season || 'kharif',
      district: farm.location?.district || 'Khordha',
      shadowCoverage: 40,
    };

    const result = cropRecommender.recommend(conditions);

    res.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        topPick: result.topPick,
        modelVersion: result.modelVersion,
        algorithm: result.algorithm,
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
    res.status(500).json({
      success: false,
      message: "Server error"
    });
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
