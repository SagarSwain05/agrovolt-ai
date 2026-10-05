const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/notificationController");

router.get("/", protect, c.list);
router.post("/read", protect, c.markRead);
router.get("/config", protect, c.config);
router.post("/subscribe", protect, c.subscribe);
router.put("/prefs", protect, c.prefs);
router.post("/test", protect, c.test);
router.get("/risk", protect, c.risk);

module.exports = router;
