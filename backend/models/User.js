const mongoose = require("mongoose");

function normalizeLang(v) {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("hi")) return "hi";
  if (s.startsWith("or") || s.startsWith("od")) return "or";
  return "en";
}

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: ["farmer", "epc", "admin"],
      default: "farmer"
    },
    farmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm"
    },
    carbonBalance: {
      type: Number,
      default: 0
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "basic", "premium"],
      default: "free"
    },
    language: {
      // 'en' | 'hi' | 'or' — older accounts may hold 'hindi'/'english'; normalise with normalizeLang()
      type: String,
      default: "en",
      set: (v) => normalizeLang(v)
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", UserSchema);
module.exports.normalizeLang = normalizeLang;
