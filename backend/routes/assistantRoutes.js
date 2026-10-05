const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/assistantController");

router.get("/status", c.status);
router.post("/chat", protect, c.chat);
router.post("/tts", protect, c.speak);
router.get("/briefing", protect, c.briefing);

module.exports = router;
