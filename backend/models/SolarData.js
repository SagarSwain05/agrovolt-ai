const mongoose = require("mongoose");

const SolarDataSchema = new mongoose.Schema(
  {
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    energyProduced: {
      type: Number, // in kWh
      required: true
    },
    efficiency: {
      type: Number, // percentage
      default: 85
    },
    dustLevel: {
      type: String,
      enum: ["clean", "light", "moderate", "heavy"],
      default: "clean"
    },
    panelTemperature: {
      type: Number, // in Celsius
      default: 25
    },
    weatherImpactScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    revenue: {
      type: Number, // in INR
      default: 0
    },
    day: {
      type: String // 'YYYY-MM-DD' (farm local) — set by the energy ledger, one row per day
    },
    irradianceKwhM2: Number, // daily insolation = peak sun hours
    ambientTempMax: Number,
    bioCoolingDeltaC: Number,
    bioCoolingGainKwh: Number,
    waterSavedLiters: Number,
    co2AvoidedKg: Number,
    isPartial: {
      type: Boolean, // true for today's running total
      default: false
    },
    source: {
      type: String,
      enum: ["model", "device", "manual"],
      default: "manual"
    }
  },
  {
    timestamps: true
  }
);

// Index for time-series queries
SolarDataSchema.index({ farmId: 1, date: -1 });
SolarDataSchema.index({ farmId: 1, day: 1 }, { unique: true, partialFilterExpression: { day: { $type: "string" } } });

module.exports = mongoose.model("SolarData", SolarDataSchema);
