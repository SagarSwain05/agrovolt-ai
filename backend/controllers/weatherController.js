const weather = require('../services/weatherService');

const coords = (q) => ({
    lat: Number.isFinite(parseFloat(q.lat)) ? parseFloat(q.lat) : 20.29,
    lon: Number.isFinite(parseFloat(q.lon)) ? parseFloat(q.lon) : 85.82,
});

// @desc    Get current weather   @route GET /api/weather/current   @access Public
exports.getCurrentWeather = async (req, res) => {
    try {
        const { lat, lon } = coords(req.query);
        res.json({ success: true, data: await weather.getCurrent(lat, lon) });
    } catch (error) {
        console.error('Weather error:', error.message);
        res.status(502).json({ success: false, message: 'Weather service unavailable' });
    }
};

// @desc    Get 7-day forecast   @route GET /api/weather/forecast   @access Public
exports.getForecast = async (req, res) => {
    try {
        const { lat, lon } = coords(req.query);
        res.json({ success: true, data: await weather.getForecast(lat, lon) });
    } catch (error) {
        console.error('Forecast error:', error.message);
        res.status(502).json({ success: false, message: 'Forecast service unavailable' });
    }
};

// @desc    Forecast-derived alerts   @route GET /api/weather/alerts   @access Public
exports.getAlerts = async (req, res) => {
    try {
        const { lat, lon } = coords(req.query);
        res.json({ success: true, data: await weather.getAlerts(lat, lon) });
    } catch (error) {
        console.error('Alerts error:', error.message);
        res.status(502).json({ success: false, message: 'Alert service unavailable' });
    }
};

// @desc    NASA POWER daily irradiance (last 7 days)   @route GET /api/weather/solar-radiation   @access Public
exports.getSolarRadiation = async (req, res) => {
    try {
        const { lat, lon } = coords(req.query);
        const nasa = require('../services/nasaPower');
        res.json({ success: true, data: await nasa.getRecentRadiation(lat, lon) });
    } catch (error) {
        console.error('NASA POWER error:', error.message);
        res.status(502).json({ success: false, message: 'NASA POWER unavailable' });
    }
};
