const express = require("express");
const router = express.Router();
const {
  scanDisease,
  getScanHistory,
  updateScanStatus
} = require("../controllers/diseaseController");
const { protect } = require("../middleware/authMiddleware");

router.post("/scan", protect, scanDisease);
router.get("/history", protect, getScanHistory);
router.put("/:id", protect, updateScanStatus);

module.exports = router;
