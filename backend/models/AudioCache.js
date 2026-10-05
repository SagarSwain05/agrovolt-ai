const mongoose = require("mongoose");

// Cached synthesized speech (keyed by provider+voice+text hash); TTL 30 days.
const AudioCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  provider: String,
  mimeType: String,
  data: Buffer,
  createdAt: { type: Date, default: Date.now, expires: 30 * 86400 }
});

module.exports = mongoose.model("AudioCache", AudioCacheSchema);
