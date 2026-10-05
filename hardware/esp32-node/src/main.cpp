// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — open-source field node
// ESP32 + RS485/Modbus: energy meter + 7-in-1 soil probe, SHT31 ambient,
// DS18B20 panel temperature. Posts JSON to /api/v1/telemetry (HTTPS) or MQTT.
// Readings are buffered (with NTP timestamps) while offline and sent in a batch.
// ═══════════════════════════════════════════════════════════════════════════
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ModbusMaster.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>
#include "config.h"

struct Reading {
  uint32_t ts;            // unix seconds (0 if clock unknown)
  float meterKwh, powerW, voltage, current;
  float soilMoist, soilTemp, soilPH, soilN, soilP, soilK;
  float ambientT, humidity, panelT;
};

static const int BUF_MAX = 48;              // ~4 h of 5-min samples
RTC_DATA_ATTR Reading buf[BUF_MAX];         // survives deep sleep
RTC_DATA_ATTR int bufLen = 0;
RTC_DATA_ATTR int sampleCount = 0;

ModbusMaster bus;
Adafruit_SHT31 sht;
#if PANEL_DS18B20_PIN >= 0
OneWire oneWire(PANEL_DS18B20_PIN);
DallasTemperature ds(&oneWire);
#endif

void preTx()  { if (RS485_DE >= 0) digitalWrite(RS485_DE, HIGH); }
void postTx() { if (RS485_DE >= 0) digitalWrite(RS485_DE, LOW); }

void busBegin(uint8_t addr, uint32_t baud) {
  Serial2.begin(baud, SERIAL_8N1, RS485_RX, RS485_TX);
  bus.begin(addr, Serial2);
  bus.preTransmission(preTx);
  bus.postTransmission(postTx);
}

float readFloat(uint16_t reg, bool input, bool wordswap) {
  uint8_t r = input ? bus.readInputRegisters(reg, 2) : bus.readHoldingRegisters(reg, 2);
  if (r != bus.ku8MBSuccess) return NAN;
  uint16_t hi = bus.getResponseBuffer(wordswap ? 1 : 0), lo = bus.getResponseBuffer(wordswap ? 0 : 1);
  uint32_t raw = ((uint32_t)hi << 16) | lo;
  float f; memcpy(&f, &raw, 4);
  return f;
}

float readScaled(uint16_t reg, float scale, bool isSigned) {
  if (bus.readHoldingRegisters(reg, 1) != bus.ku8MBSuccess) return NAN;
  uint16_t v = bus.getResponseBuffer(0);
  return (isSigned ? (int16_t)v : v) * scale;
}

Reading sample() {
  Reading r; memset(&r, 0, sizeof(r));
  r.meterKwh = r.powerW = r.voltage = r.current = NAN;
  r.soilMoist = r.soilTemp = r.soilPH = r.soilN = r.soilP = r.soilK = NAN;
  r.ambientT = r.humidity = r.panelT = NAN;
  time_t now; time(&now); r.ts = now > 1700000000 ? (uint32_t)now : 0;

#if METER_ENABLED
  busBegin(METER_ADDR, METER_BAUD);
  r.meterKwh = readFloat(METER_REG_KWH_TOTAL, METER_FUNC_INPUT, METER_WORDSWAP);
  r.powerW   = readFloat(METER_REG_POWER_W,   METER_FUNC_INPUT, METER_WORDSWAP);
  r.voltage  = readFloat(METER_REG_VOLTAGE,   METER_FUNC_INPUT, METER_WORDSWAP);
  r.current  = readFloat(METER_REG_CURRENT,   METER_FUNC_INPUT, METER_WORDSWAP);
#endif
#if SOIL_ENABLED
  busBegin(SOIL_ADDR, SOIL_BAUD);
  r.soilMoist = readScaled(SOIL_REG_MOISTURE, 0.1f, false);
  r.soilTemp  = readScaled(SOIL_REG_TEMP, 0.1f, true);
  r.soilPH    = readScaled(SOIL_REG_PH, 0.01f, false);
  r.soilN     = readScaled(SOIL_REG_N, 1, false);
  r.soilP     = readScaled(SOIL_REG_P, 1, false);
  r.soilK     = readScaled(SOIL_REG_K, 1, false);
#endif
#if SHT31_ENABLED
  if (sht.begin(0x44)) { r.ambientT = sht.readTemperature(); r.humidity = sht.readHumidity(); }
#endif
#if PANEL_DS18B20_PIN >= 0
  ds.begin(); ds.requestTemperatures();
  float t = ds.getTempCByIndex(0);
  if (t > -55 && t < 125) r.panelT = t;
#endif
  return r;
}

void put(JsonObject o, const char* k, float v, int dp = 2) {
  if (!isnan(v)) o[k] = serialized(String(v, dp));
}

String toJson(int from, int count) {
  JsonDocument doc;
  JsonArray arr = doc["readings"].to<JsonArray>();
  for (int i = from; i < from + count; i++) {
    const Reading& r = buf[i];
    JsonObject o = arr.add<JsonObject>();
    if (r.ts) o["ts"] = r.ts;
    put(o, "meter_kwh_total", r.meterKwh, 3); put(o, "power_w", r.powerW, 1);
    put(o, "voltage_v", r.voltage, 1);        put(o, "current_a", r.current, 2);
    put(o, "soil_moisture_pct", r.soilMoist, 1); put(o, "soil_temp", r.soilTemp, 1);
    put(o, "soil_ph", r.soilPH, 2); put(o, "soil_n", r.soilN, 0); put(o, "soil_p", r.soilP, 0); put(o, "soil_k", r.soilK, 0);
    put(o, "ambient_temp", r.ambientT, 1); put(o, "humidity_pct", r.humidity, 1); put(o, "panel_temp", r.panelT, 1);
  }
  String out; serializeJson(doc, out);
  return out;
}

bool wifiUp() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  if (WiFi.status() != WL_CONNECTED) return false;
  configTime(19800, 0, "pool.ntp.org", "time.google.com");   // IST
  return true;
}

bool postHttps(const String& body) {
  WiFiClientSecure tls; tls.setInsecure();   // pin the Render CA in production
  HTTPClient http;
  if (!http.begin(tls, AGROVOLT_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", AGROVOLT_DEVICE_KEY);
  http.setTimeout(20000);
  int code = http.POST(body);            // Render may cold-start: generous timeout
  Serial.printf("[http] %d %s\n", code, http.getString().c_str());
  http.end();
  return code == 201 || code == 200;
}

bool postMqtt(const String& body) {
  if (strlen(MQTT_HOST) == 0) return false;
  WiFiClientSecure tls; tls.setInsecure();
  PubSubClient mq(tls);
  mq.setServer(MQTT_HOST, MQTT_PORT);
  mq.setBufferSize(4096);
  if (!mq.connect("agrovolt-node", MQTT_USER, MQTT_PASS)) return false;
  // MQTT bridge expects the key inside the payload
  String withKey = "{\"key\":\"" AGROVOLT_DEVICE_KEY "\"," + body.substring(1);
  bool ok = mq.publish(MQTT_TOPIC, withKey.c_str());
  mq.disconnect();
  return ok;
}

void setup() {
  Serial.begin(115200);
  if (RS485_DE >= 0) { pinMode(RS485_DE, OUTPUT); digitalWrite(RS485_DE, LOW); }
  Wire.begin(21, 22);

  wifiUp();                     // also syncs the clock for timestamps
  Reading r = sample();
  if (bufLen >= BUF_MAX) { memmove(buf, buf + 1, sizeof(Reading) * (BUF_MAX - 1)); bufLen--; }
  buf[bufLen++] = r;
  sampleCount++;

  if (sampleCount % UPLOAD_EVERY_N == 0 || bufLen >= BUF_MAX - 2) {
    if (wifiUp()) {
      String body = toJson(0, bufLen);
      bool ok = postHttps(body) || postMqtt(body);
      if (ok) bufLen = 0;        // keep buffer on failure; retry next cycle
    }
  }
  WiFi.disconnect(true);
  esp_sleep_enable_timer_wakeup((uint64_t)SAMPLE_INTERVAL_S * 1000000ULL);
  esp_deep_sleep_start();
}

void loop() {}
