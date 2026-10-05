const express = require("express");
const router = express.Router();
const iot = require("../controllers/iotController");

// Standardised hardware endpoint (ESP32 / LoRaWAN gateway / Modbus bridge)
router.post("/telemetry", iot.ingest);

module.exports = router;
