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
    sourceDay: {
      type: String // 'YYYY-MM-DD' for automatic daily accruals from the energy ledger
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

CarbonTransactionSchema.index({ farmId: 1, sourceDay: 1 }, { unique: true, partialFilterExpression: { sourceDay: { $type: "string" } } });

module.exports = mongoose.model("CarbonTransaction", CarbonTransactionSchema);
