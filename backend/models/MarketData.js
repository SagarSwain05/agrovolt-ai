const mongoose = require("mongoose");

const MarketDataSchema = new mongoose.Schema(
  {
    cropName: {
      type: String,
      required: true
    },
    mandiName: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    price: {
      type: Number, // per quintal in INR
      required: true
    },
    minPrice: {
      type: Number
    },
    maxPrice: {
      type: Number
    },
    date: {
      type: Date,
      default: Date.now
    },
    trendScore: {
      type: Number, // -100 to +100
      default: 0
    },
    demand: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
MarketDataSchema.index({ cropName: 1, date: -1 });
MarketDataSchema.index({ state: 1, district: 1 });

module.exports = mongoose.model("MarketData", MarketDataSchema);
