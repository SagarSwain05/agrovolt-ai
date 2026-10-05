const mongoose = require("mongoose");

// Cached machine translations of dynamic content (diagnoses, treatments, alerts).
const TranslationCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    lang: String,
    value: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

module.exports = mongoose.model("TranslationCache", TranslationCacheSchema);
