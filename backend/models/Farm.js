const mongoose = require("mongoose");

const FarmSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    farmName: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      },
      address: String,
      district: String,
      state: String
    },
    farmSize: {
      type: Number,
      required: true // in acres
    },
    soilType: {
      type: String,
      enum: ["clay", "loamy", "sandy", "silt", "peat", "chalk"],
      default: "loamy"
    },
    solarInstalled: {
      type: Boolean,
      default: false
    },
    solarCapacityKW: {
      type: Number,
      default: 0
    },
    panelHeight: {
      type: Number, // in meters
      default: 3
    },
    panelTilt: {
      type: Number, // in degrees
      default: 25
    },
    panelCount: {
      type: Number,
      default: 0
    },
    crops: [
      {
        cropName: String,
        season: String,
        sowingDate: Date,
        expectedHarvestDate: Date
      }
    ],
    healthScore: {
      type: Number,
      default: 75,
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Farm", FarmSchema);
