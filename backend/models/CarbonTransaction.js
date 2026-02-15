const mongoose = require("mongoose");

const CarbonTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true
    },
    creditsEarned: {
      type: Number,
      required: true
    },
    waterSavedLiters: {
      type: Number,
      default: 0
    },
    co2ReducedKg: {
      type: Number,
      default: 0
    },
    transactionType: {
      type: String,
      enum: ["earned", "withdrawn", "traded"],
      default: "earned"
    },
    monetaryValue: {
      type: Number, // in INR
      default: 0
    },
    description: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("CarbonTransaction", CarbonTransactionSchema);
