const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { check } = require("../controllers/schemeController");

router.post("/check", protect, check);

module.exports = router;
