const mongoose = require("mongoose");

// Persisted Open-Meteo bundles: survive restarts and serve stale data when the API throttles.
const WeatherCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: mongoose.Schema.Types.Mixed,
  fetchedAt: { type: Date, default: Date.now, expires: 3 * 86400 }
});

module.exports = mongoose.model("WeatherCache", WeatherCacheSchema);
