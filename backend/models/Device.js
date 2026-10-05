const mongoose = require("mongoose");

// A physical field node (ESP32 / LoRaWAN gateway) allowed to push telemetry for a farm.
const DeviceSchema = new mongoose.Schema(
  {
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["esp32", "lorawan", "gateway", "other"], default: "esp32" },
    keyHash: { type: String, required: true, unique: true }, // sha256 of the device API key
    keyPrefix: { type: String }, // first chars, shown in UI to identify the key
    lastSeenAt: Date,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Device", DeviceSchema);
