const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/farmController");

router.get("/", protect, c.getFarm);
router.put("/", protect, c.updateFarm);
router.put("/me", protect, c.updateMe);
router.get("/geocode", protect, c.geocode);

module.exports = router;
