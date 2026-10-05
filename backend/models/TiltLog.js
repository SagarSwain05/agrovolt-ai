const mongoose = require("mongoose");

// History of panel tilt changes (MRV evidence: which angle produced which energy).
const TiltLogSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true, index: true },
  tiltDeg: Number,
  optimalDeg: Number,
  source: { type: String, enum: ["settings", "sun-chaser", "device"], default: "settings" },
  at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TiltLog", TiltLogSchema);
