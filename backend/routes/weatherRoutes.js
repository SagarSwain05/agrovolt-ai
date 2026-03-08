const express = require("express");
const router = express.Router();
const {
    getCurrentWeather,
    getForecast,
    getAlerts,
    getSolarRadiation,
} = require("../controllers/weatherController");

// Public routes (no auth required for weather data)
router.get("/current", getCurrentWeather);
router.get("/forecast", getForecast);
router.get("/alerts", getAlerts);
router.get("/solar-radiation", getSolarRadiation);

module.exports = router;
