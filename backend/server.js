const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    // In production, also allow any vercel.app subdomain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    callback(null, true); // Allow all for now — tighten later
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/crop", require("./routes/cropRoutes"));
app.use("/api/solar", require("./routes/solarRoutes"));
app.use("/api/disease", require("./routes/diseaseRoutes"));
app.use("/api/carbon", require("./routes/carbonRoutes"));
app.use("/api/market", require("./routes/marketRoutes"));
app.use("/api/weather", require("./routes/weatherRoutes"));
app.use("/api/scan", require("./routes/scanRoutes"));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🌾⚡ AgroVolt AI Backend Running",
    version: "1.0.0",
    status: "active"
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
