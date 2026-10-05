const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getDistrict } = require("../controllers/districtController");

router.get("/", protect, getDistrict);

module.exports = router;
