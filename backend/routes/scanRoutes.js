const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');

// Define scan routes
router.post('/crop', scanController.scanCropDisease);
router.post('/panel', scanController.scanPanelDefect);
router.post('/growth', scanController.scanGrowthStage);

module.exports = router;
