const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Farm = require("../models/Farm");
const axios = require("axios");

/** Resolve "district, state" to coordinates (OpenStreetMap Nominatim). */
async function geocodeDistrict(district, state) {
  if (!district) return null;
  try {
    const { data } = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${district}, ${state || "Odisha"}, India`, format: "json", limit: 1, addressdetails: 1 },
      headers: { "User-Agent": "AgroVolt-AI/1.0 (agrovolt-ai.vercel.app)" },
      timeout: 8000,
    });
    if (!data?.[0]) return null;
    return { latitude: Number(data[0].lat), longitude: Number(data[0].lon), state: data[0].address?.state };
  } catch {
    return null;
  }
}

const mailer = require("../services/email");
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 45 * 1000;

function publicUser(user) {
  return {
    _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, language: user.language,
    farmId: user.farmId, partnerCode: user.partnerCode, organization: user.organization, emailVerified: user.emailVerified !== false,
  };
}

/** Create, store (hashed) and email a 6-digit code. */
async function issueOtp(user, purpose) {
  if (user.emailOtp?.sentAt && Date.now() - new Date(user.emailOtp.sentAt).getTime() < OTP_RESEND_MS && user.emailOtp.purpose === purpose) {
    return { throttled: true };
  }
  const code = String(require("crypto").randomInt(0, 1000000)).padStart(6, "0");
  user.emailOtp = { hash: await bcrypt.hash(code, 8), purpose, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, sentAt: new Date() };
  await user.save();
  await mailer.sendOtp({ to: user.email, name: user.name, code, purpose, lang: user.language || "en" });
  return { sent: true };
}

/** Check a code; clears it on success. Returns null on success or an error message. */
async function checkOtp(user, code, purpose) {
  const o = user.emailOtp;
  if (!o?.hash || o.purpose !== purpose) return "No code requested. Please request a new code.";
  if (new Date(o.expiresAt) < new Date()) return "Code expired. Please request a new code.";
  if ((o.attempts || 0) >= 5) return "Too many attempts. Please request a new code.";
  const ok = await bcrypt.compare(String(code || "").trim(), o.hash);
  if (!ok) {
    user.emailOtp.attempts = (o.attempts || 0) + 1;
    await user.save();
    return "Incorrect code.";
  }
  user.emailOtp = undefined;
  return null;
}

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, farmName, farmSize, location, language, soilType, organization } = req.body;
    const role = ["farmer", "epc", "fpo"].includes(req.body.role) ? req.body.role : "farmer";

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password"
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      language,
      role,
      emailVerified: mailer.isConfigured() ? false : undefined,
      ...(role !== "farmer" ? { organization, partnerCode: `${role.toUpperCase()}-${require("crypto").randomBytes(3).toString("hex").toUpperCase()}` } : {})
    });

    // Every account gets a farm (defaults are editable in Settings)
    {
      const loc = { ...(location || {}) };
      if (!Number(loc.latitude) || !Number(loc.longitude)) {
        const g = await geocodeDistrict(loc.district || req.body.district, loc.state || req.body.state);
        if (g) Object.assign(loc, { latitude: g.latitude, longitude: g.longitude, state: loc.state || g.state });
      }
      const actualFarmName = farmName || `${name}'s Farm`;
      const actualFarmSize = farmSize || 2; // Default size if empty
      const farm = await Farm.create({
        userId: user._id,
        farmName: actualFarmName,
        farmSize: actualFarmSize,
        ...(soilType ? { soilType } : {}),
        location: {
          latitude: Number(loc.latitude) || 20.2961,
          longitude: Number(loc.longitude) || 85.8245,
          address: loc.address || "",
          district: loc.district || req.body.district || "",
          state: loc.state || req.body.state || "Odisha"
        }
      });

      user.farmId = farm._id;
      await user.save();
    }

    if (user.emailVerified === false) {
      try { await issueOtp(user, "verify"); }
      catch (e) { console.error("[auth] verification email failed:", e.message); }
      return res.status(201).json({
        success: true,
        message: "Account created. Enter the 6-digit code sent to your email.",
        data: { needsVerification: true, email: user.email },
      });
    }
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: { ...publicUser(user), token: generateToken(user._id) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error during registration"
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password"
      });
    }

    // Check user
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (user.emailVerified === false) {
      await issueOtp(user, "verify").catch((e) => console.error("[auth] resend:", e.message));
      return res.status(403).json({ success: false, code: "email_unverified", email: user.email, message: "Please verify your email. We sent you a new code." });
    }

    res.json({
      success: true,
      message: "Login successful",
      data: { ...publicUser(user), token: generateToken(user._id) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("farmId");

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// @desc    Verify email with the 6-digit code → logs the user in
// @route   POST /api/auth/verify-email  { email, code }
exports.verifyEmail = async (req, res) => {
  const user = await User.findOne({ email: String(req.body?.email || "").toLowerCase().trim() });
  if (!user) return res.status(400).json({ success: false, message: "Account not found" });
  if (user.emailVerified !== false) return res.json({ success: true, data: { ...publicUser(user), token: generateToken(user._id) } });
  const err = await checkOtp(user, req.body?.code, "verify");
  if (err) return res.status(400).json({ success: false, message: err });
  user.emailVerified = true;
  await user.save();
  res.json({ success: true, message: "Email verified", data: { ...publicUser(user), token: generateToken(user._id) } });
};

// @desc    Resend a verification code
// @route   POST /api/auth/resend-code  { email }
exports.resendCode = async (req, res) => {
  const user = await User.findOne({ email: String(req.body?.email || "").toLowerCase().trim() });
  // Same response whether or not the account exists (no account enumeration)
  if (user && user.emailVerified === false) {
    const r = await issueOtp(user, "verify").catch((e) => ({ error: e.message }));
    if (r?.throttled) return res.status(429).json({ success: false, message: "Please wait a few seconds before requesting another code." });
  }
  res.json({ success: true, message: "If the account needs verification, a new code has been sent." });
};

// @desc    Start password reset — emails a code
// @route   POST /api/auth/forgot-password  { email }
exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: String(req.body?.email || "").toLowerCase().trim() });
  if (user) {
    const r = await issueOtp(user, "reset").catch((e) => ({ error: e.message }));
    if (r?.throttled) return res.status(429).json({ success: false, message: "Please wait a few seconds before requesting another code." });
  }
  res.json({ success: true, message: "If an account exists for this email, a reset code has been sent." });
};

// @desc    Reset password with the emailed code
// @route   POST /api/auth/reset-password  { email, code, password }
exports.resetPassword = async (req, res) => {
  const { code, password } = req.body || {};
  if (!password || String(password).length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  const user = await User.findOne({ email: String(req.body?.email || "").toLowerCase().trim() });
  if (!user) return res.status(400).json({ success: false, message: "Incorrect code." });
  const err = await checkOtp(user, code, "reset");
  if (err) return res.status(400).json({ success: false, message: err });
  user.password = await bcrypt.hash(String(password), await bcrypt.genSalt(10));
  user.emailVerified = true; // proving inbox access also verifies the email
  await user.save();
  res.json({ success: true, message: "Password updated", data: { ...publicUser(user), token: generateToken(user._id) } });
};
