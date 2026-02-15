const Farm = require("../models/Farm");
const Crop = require("../models/Crop");

// Crop recommendation logic (rule-based for pilot)
const getCropRecommendations = (soilType, rainfall, season, location) => {
  const recommendations = [];

  // Rule-based recommendations
  if (soilType === "loamy" && rainfall > 500) {
    recommendations.push(
      { name: "Tomato", yield: 250, revenue: 500000, waterReq: "Medium", shadeTolerance: "High" },
      { name: "Turmeric", yield: 180, revenue: 540000, waterReq: "Medium", shadeTolerance: "High" },
      { name: "Rice", yield: 300, revenue: 450000, waterReq: "High", shadeTolerance: "Medium" }
    );
  } else if (soilType === "sandy" || rainfall < 500) {
    recommendations.push(
      { name: "Millet", yield: 150, revenue: 225000, waterReq: "Low", shadeTolerance: "High" },
      { name: "Wheat", yield: 200, revenue: 400000, waterReq: "Medium", shadeTolerance: "Medium" },
      { name: "Groundnut", yield: 120, revenue: 360000, waterReq: "Low", shadeTolerance: "Medium" }
    );
  } else {
    recommendations.push(
      { name: "Wheat", yield: 200, revenue: 400000, waterReq: "Medium", shadeTolerance: "Medium" },
      { name: "Millet", yield: 150, revenue: 225000, waterReq: "Low", shadeTolerance: "High" },
      { name: "Soybean", yield: 180, revenue: 360000, waterReq: "Medium", shadeTolerance: "High" }
    );
  }

  return recommendations;
};

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

    const recommendations = getCropRecommendations(
      soilType || farm.soilType,
      rainfall || 600,
      season || "kharif",
      farm.location
    );

    res.json({
      success: true,
      data: {
        recommendations,
        farmDetails: {
          soilType: farm.soilType,
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
