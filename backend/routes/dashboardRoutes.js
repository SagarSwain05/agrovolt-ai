const express = require("express");
const router = express.Router();
const { getDashboard, getProfit } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getDashboard);
router.get("/profit", protect, getProfit);

module.exports = router;
