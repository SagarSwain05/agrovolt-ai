const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { season } = require("../controllers/reportController");

router.get("/season", protect, season);

module.exports = router;
