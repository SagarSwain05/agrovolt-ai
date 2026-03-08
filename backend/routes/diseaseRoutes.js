const express = require("express");
const router = express.Router();
const {
  scanDisease,
  getScanHistory,
  updateScanStatus,
  scanPanel,
  getFarmContext,
  analyzeImage
} = require("../controllers/diseaseController");
const { protect } = require("../middleware/authMiddleware");

router.post("/scan", protect, scanDisease);
router.post("/scan-panel", protect, scanPanel);
router.post("/analyze", protect, analyzeImage);
router.get("/context", protect, getFarmContext);
router.get("/history", protect, getScanHistory);
router.put("/:id", protect, updateScanStatus);

module.exports = router;

