// Copy to config.h and fill in. config.h is git-ignored.
#pragma once

// ── Network ──────────────────────────────────────────────
#define WIFI_SSID        "your-wifi"
#define WIFI_PASSWORD    "your-password"

// ── AgroVolt ─────────────────────────────────────────────
// Device key from AgroVolt → Settings → Field sensors → Add device (shown once)
#define AGROVOLT_DEVICE_KEY  "avk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#define AGROVOLT_URL         "https://agrovolt-backend.onrender.com/api/v1/telemetry"

// Transport: 1 = MQTT over secure WebSocket to AgroVolt's built-in broker
//            (persistent, lower overhead), 0 = HTTPS POST only.
// HTTPS is always used as the fallback if MQTT fails.
#define USE_MQTT         1
#define MQTT_URI         "wss://agrovolt-backend.onrender.com/mqtt"
#define MQTT_TOPIC       "agrovolt/node-1/telemetry"   // any name; acks arrive on agrovolt/<first 10 chars of key>/ack

// ── Timing ───────────────────────────────────────────────
#define SAMPLE_INTERVAL_S   300   // read sensors every 5 min
#define UPLOAD_EVERY_N      3     // upload every 3rd sample (15 min); buffered while offline

// ── RS485 / Modbus RTU (MAX485 or auto-direction module) ─
#define RS485_RX   16
#define RS485_TX   17
#define RS485_DE   4      // DE+RE tied together; set -1 for auto-direction modules

// Energy meter (e.g. Schneider EM6400NG, Elmeasure LG+, Selec, any Modbus RTU meter)
#define METER_ENABLED        1
#define METER_ADDR           1
#define METER_BAUD           9600
// !! Verify these against YOUR meter's Modbus register map (manual) !!
// Default layout: 32-bit IEEE-754 float, big-endian word order, input/holding registers.
#define METER_FUNC_INPUT     0        // 1 = read input registers (0x04), 0 = holding (0x03)
#define METER_REG_KWH_TOTAL  0x0156   // total import active energy, kWh (float32)
#define METER_REG_POWER_W    0x000C   // total active power, W (float32)
#define METER_REG_VOLTAGE    0x0000   // L-N voltage, V (float32)
#define METER_REG_CURRENT    0x0006   // current, A (float32)
#define METER_WORDSWAP       0        // 1 if your meter sends low word first

// 7-in-1 RS485 soil probe (JXCT-style map: moisture, temperature, EC, pH, N, P, K)
#define SOIL_ENABLED         1
#define SOIL_ADDR            2        // change the probe's address from 1 → 2 if it shares the bus with the meter
#define SOIL_BAUD            4800
#define SOIL_REG_MOISTURE    0x0012   // ×0.1 %
#define SOIL_REG_TEMP        0x0013   // ×0.1 °C (signed)
#define SOIL_REG_PH          0x0006   // ×0.01
#define SOIL_REG_N           0x001E   // mg/kg
#define SOIL_REG_P           0x001F
#define SOIL_REG_K           0x0020

// ── Local sensors ────────────────────────────────────────
#define SHT31_ENABLED     1      // I2C ambient temp/humidity (SDA 21, SCL 22)
#define PANEL_DS18B20_PIN 15     // DS18B20 stuck to the panel back sheet; -1 to disable
