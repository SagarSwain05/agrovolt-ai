const express = require("express");
const router = express.Router();
const {
  getSolarOptimization,
  addSolarData,
  getSolarHistory
} = require("../controllers/solarController");
const { protect } = require("../middleware/authMiddleware");

router.get("/optimize", protect, getSolarOptimization);
router.post("/data", protect, addSolarData);
router.get("/history", protect, getSolarHistory);

module.exports = router;
