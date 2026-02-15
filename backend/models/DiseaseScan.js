const mongoose = require("mongoose");

const DiseaseScanSchema = new mongoose.Schema(
  {
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      required: true
    },
    cropName: {
      type: String,
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    detectedDisease: {
      type: String,
      default: "Healthy"
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    treatment: {
      type: String,
      default: "No treatment needed"
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low"
    },
    scannedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["pending", "treated", "resolved"],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DiseaseScan", DiseaseScanSchema);
