const mongoose = require("mongoose");

// White-label API credential for an EPC / OEM / FPO partner.
const PartnerKeySchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    keyPrefix: String,
    scopes: { type: [String], default: ["crop", "diagnostics", "solar", "risk"] },
    webhookUrl: String,
    webhookSecret: String,
    webhookEvents: { type: [String], default: ["disease.detected", "risk.alert", "soiling.alert"] },
    dailyQuota: { type: Number, default: 2000 },
    usage: { day: String, count: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
    lastUsedAt: Date,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PartnerKey", PartnerKeySchema);
