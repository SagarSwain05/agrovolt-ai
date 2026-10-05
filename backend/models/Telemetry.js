const mongoose = require("mongoose");

// One sensor reading from the field. `source` distinguishes physical devices
// from the weather-driven virtual node used before hardware is installed.
const TelemetrySchema = new mongoose.Schema(
  {
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Device" },
    source: { type: String, enum: ["device", "virtual"], required: true },
    ts: { type: Date, default: Date.now },
    ambientTempC: Number,
    underCanopyTempC: Number,
    humidityPct: Number,
    panelTempC: Number,
    panelTempUncooledC: Number,
    irradianceWm2: Number,
    lux: Number,
    parCrop: Number, // µmol/m²/s at crop level
    soilMoisturePct: Number,
    soilTempC: Number,
    soilN: Number, // mg/kg
    soilP: Number,
    soilK: Number,
    soilPH: Number,
    powerW: Number,
    energyTodayKwh: Number,
    panelTiltDeg: Number,
    meterKwhTotal: Number, // cumulative import/generation register of an RS485 energy meter
    voltageV: Number,
    currentA: Number,
    leafWetnessPct: Number,
    rainMm: Number
  },
  { timestamps: false }
);

TelemetrySchema.index({ farmId: 1, ts: -1 });
// Keep 30 days of raw readings
TelemetrySchema.index({ ts: 1 }, { expireAfterSeconds: 30 * 86400 });

module.exports = mongoose.model("Telemetry", TelemetrySchema);
