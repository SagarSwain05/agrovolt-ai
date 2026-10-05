const express = require("express");
const router = express.Router();
const {
  getMarketPrices,
  getPriceTrends,
  getSellingRecommendation,
  reportPrice,
  getStatus
} = require("../controllers/marketController");
const { protect } = require("../middleware/authMiddleware");

router.get("/prices", protect, getMarketPrices);
router.post("/report", protect, reportPrice);
router.get("/status", protect, getStatus);
router.get("/trends", protect, getPriceTrends);
router.get("/recommend", protect, getSellingRecommendation);

module.exports = router;
