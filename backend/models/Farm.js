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
      enum: ["clay", "loamy", "sandy", "silt", "peat", "chalk", "alluvial", "red", "black", "laterite"],
      default: "loamy"
    },
    solarInstalled: {
      type: Boolean,
      default: false
    },
    solarSince: {
      type: Date // installation / commissioning date — energy & carbon ledger starts here
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
    panelAzimuth: {
      type: Number, // degrees, 180 = facing south
      default: 180
    },
    shadeCoverage: {
      type: Number, // % of cropped land shaded by the array
      default: 35,
      min: 0,
      max: 90
    },
    cropUnderPanels: {
      type: String, // current understory crop, drives bio-cooling coefficient
      default: "general"
    },
    tariffPerKwh: {
      type: Number, // ₹ earned/saved per kWh (PM-KUSUM feed-in or avoided cost)
      default: 6
    },
    annualRainfall: {
      type: Number, // mm
      default: 1450
    },
    crops: [
      {
        cropName: String,
        season: String,
        sowingDate: Date,
        expectedHarvestDate: Date
      }
    ],
    // Physical sensors: flips true on the first valid hardware reading (UI drops the "Virtual sensor" tag)
    isHardwareVerified: {
      type: Boolean,
      default: false
    },
    hardwareVerifiedAt: Date,
    // Learned corrections applied to the virtual sensor / energy model
    calibration: {
      irradianceFactor: { type: Number, default: 1 },   // NASA POWER observed ÷ Open-Meteo modelled
      irradianceDays: { type: Number, default: 0 },
      irradianceUpdatedAt: Date,
      soilMoistureFactor: { type: Number, default: 1 }, // device ÷ virtual (EMA)
      panelTempOffset: { type: Number, default: 0 },    // device − virtual °C (EMA)
      powerFactor: { type: Number, default: 1 },        // device ÷ virtual (EMA)
      samples: { type: Number, default: 0 }
    },
    epcPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User" // EPC/solar company with fleet access granted by the farmer
    },
    lastSoilingWebhook: String,
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
