const express = require("express");
const router = express.Router();
const {
  getCarbonWallet,
  calculateCredits,
  withdrawCredits,
  getCarbonHistory
} = require("../controllers/carbonController");
const { protect } = require("../middleware/authMiddleware");

router.get("/wallet", protect, getCarbonWallet);
router.post("/calculate", protect, calculateCredits);
router.post("/withdraw", protect, withdrawCredits);
router.get("/history", protect, getCarbonHistory);

module.exports = router;
