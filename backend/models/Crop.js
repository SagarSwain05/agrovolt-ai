const mongoose = require("mongoose");

const CropSchema = new mongoose.Schema(
  {
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true
    },
    cropName: {
      type: String,
      required: true
    },
    season: {
      type: String,
      enum: ["kharif", "rabi", "zaid"],
      required: true
    },
    sowingDate: {
      type: Date,
      required: true
    },
    expectedHarvestDate: {
      type: Date,
      required: true
    },
    predictedYield: {
      type: Number, // in quintals
      default: 0
    },
    actualYield: {
      type: Number,
      default: 0
    },
    healthScore: {
      type: Number,
      default: 80,
      min: 0,
      max: 100
    },
    riskScore: {
      type: Number,
      default: 20,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ["planned", "sown", "growing", "harvested"],
      default: "planned"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Crop", CropSchema);
