const express = require("express");
const router = express.Router();
const { register, login, getMe, verifyEmail, resendCode, forgotPassword, resetPassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Simple per-IP limiter for endpoints that send email or check codes
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const k = `${req.ip}|${req.path}`;
    const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ success: false, message: "Too many attempts. Please try again later." });
    arr.push(now);
    hits.set(k, arr);
    next();
  };
}

router.post("/register", limit(10, 60 * 60e3), register);
router.post("/login", limit(30, 15 * 60e3), login);
router.post("/verify-email", limit(20, 15 * 60e3), verifyEmail);
router.post("/resend-code", limit(6, 15 * 60e3), resendCode);
router.post("/forgot-password", limit(6, 15 * 60e3), forgotPassword);
router.post("/reset-password", limit(20, 15 * 60e3), resetPassword);
router.get("/me", protect, getMe);

module.exports = router;
