const mongoose = require("mongoose");

// Mandi price reported by a farmer or FPO (crowd-sourced fallback when Agmarknet is down).
const PriceReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: String,
    crop: { type: String, required: true },
    mandi: { type: String, required: true, trim: true },
    district: String,
    state: String,
    price: { type: Number, required: true, min: 1, max: 100000 }, // ₹ per quintal
    soldQty: Number,
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
PriceReportSchema.index({ crop: 1, state: 1, date: -1 });

module.exports = mongoose.model("PriceReport", PriceReportSchema);
