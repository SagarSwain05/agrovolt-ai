const express = require("express");
const router = express.Router();
const {
  getRecommendations,
  addCrop,
  getCrops,
  updateCrop
} = require("../controllers/cropController");
const { protect } = require("../middleware/authMiddleware");

router.post("/recommend", protect, getRecommendations);
router.post("/", protect, addCrop);
router.get("/", protect, getCrops);
router.put("/:id", protect, updateCrop);

module.exports = router;
