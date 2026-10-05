const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["disease_risk", "weather", "outbreak", "solar", "market", "system"], default: "system" },
    level: { type: String, enum: ["info", "medium", "high"], default: "info" },
    title: String,
    body: String,
    lang: String,
    data: Object,
    dedupeKey: { type: String }, // one notification per user per key (e.g. late_blight|2026-10-05)
    channels: { inApp: { type: Boolean, default: true }, email: Boolean, push: Boolean, sms: Boolean, whatsapp: Boolean },
    deliveryErrors: [String],
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);
NotificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 86400 });

module.exports = mongoose.model("Notification", NotificationSchema);
