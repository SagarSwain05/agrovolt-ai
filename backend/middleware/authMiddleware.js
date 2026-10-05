const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed"
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token"
    });
  }
};

// Admin middleware
exports.admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Not authorized as admin"
    });
  }
};

// Attach req.user when a valid Bearer token is present, but never reject.
exports.optionalAuth = async (req, res, next) => {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(h.split(" ")[1], process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch { /* anonymous */ }
  }
  next();
};

// For EventSource streams, which cannot send headers: token arrives as ?token=
exports.protectQueryToken = async (req, res, next) => {
  try {
    const token = req.query.token || (req.headers.authorization || "").split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Not authorized, no token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ success: false, message: "User not found" });
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Not authorized, token failed" });
  }
};
