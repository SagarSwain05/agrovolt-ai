const express = require("express");
const router = express.Router();
const { protect, protectQueryToken } = require("../middleware/authMiddleware");
const c = require("../controllers/iotController");

router.post("/telemetry", c.ingest); // device-key auth
router.get("/stream", protectQueryToken, c.stream);
router.get("/latest", protect, c.latest);
router.get("/history", protect, c.history);
router.get("/devices", protect, c.listDevices);
router.post("/devices", protect, c.registerDevice);
router.delete("/devices/:id", protect, c.deleteDevice);

module.exports = router;
