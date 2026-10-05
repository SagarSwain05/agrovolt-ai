# AgroVolt AI — Open-source field node (ESP32 + RS485/Modbus)

A low-cost node that turns a farm's **virtual sensor** into **hardware-verified** data. It reads a standard RS485 energy meter and soil probe, timestamps every reading, buffers through network outages, and posts to AgroVolt. The first valid reading flips the farm to `is_hardware_verified` and replaces the "Virtual sensor" tag. Metered days count as verifiable in the carbon MRV report.

## Bill of materials (≈ ₹4,500–9,000)

| Part | Example | Approx. ₹ |
|---|---|---|
| ESP32 DevKit (WROOM-32) | any 38-pin board | 450 |
| RS485 transceiver | MAX485 module, or an auto-direction TTL↔RS485 module | 80–250 |
| Energy meter, Modbus RTU | Schneider EM6400NG, Elmeasure LG+, Selec MFM, or any DIN-rail kWh meter with RS485 | 2,500–6,000 (often already installed under PM-KUSUM) |
| Soil probe, RS485 | 7-in-1 moisture/temperature/EC/pH/N/P/K (JXCT-style) | 1,800–3,500 |
| Ambient temp/RH | SHT31 (I²C) | 250 |
| Panel temperature | DS18B20, waterproof, stuck to the back sheet with thermal tape | 120 |
| Power | 12 V adapter or 12 V solar battery + LM2596 buck to 5 V | 300 |
| Enclosure | IP65 box, cable glands | 300 |

## Wiring

```
ESP32 GPIO17 (TX2) ──► DI  ┐
ESP32 GPIO16 (RX2) ◄── RO  │ MAX485 ── A ─┬─ Meter A ── Soil probe A
ESP32 GPIO4  ────────► DE+RE│           B ─┴─ Meter B ── Soil probe B   (120 Ω terminator at the far end)
3V3 / GND ─────────── VCC/GND┘
SHT31: SDA→GPIO21, SCL→GPIO22, 3V3, GND
DS18B20: data→GPIO15 (4.7 kΩ pull-up to 3V3)
Soil probe power: 12 V (most 7-in-1 probes need 5–24 V)
```

The meter and soil probe share one RS485 bus. **Give them different Modbus addresses.** The meter defaults to 1; change the probe to 2 with its address-setting command. The node switches baud rate per device (meter 9600, probe 4800 by default).

## Register maps

`src/config.example.h` holds the register addresses. **Always check them against your meter's manual.** Register layouts differ between models and firmware versions.

- **Energy meter:** total imported active energy (kWh, float32), active power (W), voltage, current. Set `METER_FUNC_INPUT` (input vs holding registers) and `METER_WORDSWAP` to match your meter.
- **7-in-1 soil probe (JXCT map):** moisture `0x0012` (×0.1 %), temperature `0x0013` (×0.1 °C), pH `0x0006` (×0.01), N/P/K `0x001E/0x001F/0x0020` (mg/kg).

## Setup

1. In AgroVolt → **Settings → Field sensors → Add device**. Copy the device key, which is shown only once.
2. Copy `src/config.example.h` to `src/config.h` and fill in Wi-Fi, the key and the register map.
3. Build and flash with [PlatformIO](https://platformio.org): `pio run -t upload && pio device monitor`
4. The serial monitor should show `[http] 201 {"success":true,"accepted":…,"is_hardware_verified":true}`.

## Data contract — `POST /api/v1/telemetry`

Header `X-Device-Key: avk_…`. Body is a single reading or `{"readings":[…]}`. Field names are snake_case or camelCase:

```json
{ "farmId": "optional — must match the device's farm",
  "ts": 1791200000,
  "energy_kwh": 12.4, "meter_kwh_total": 1525.9, "power_w": 2150,
  "soil_moisture_pct": 31.5, "soil_temp": 27.1, "soil_ph": 6.4, "soil_n": 210, "soil_p": 18, "soil_k": 160,
  "ambient_temp": 32.4, "humidity_pct": 61, "panel_temp": 47.2,
  "irradiance_wm2": 640, "leaf_wetness_pct": 20, "rain_mm": 0, "tilt_deg": 26 }
```

- Out-of-range values are dropped, and the response reports how many readings were accepted and rejected.
- The `meter_kwh_total` register delta (or `energy_kwh`) becomes that day's **metered** generation in the energy and carbon ledger.
- `humidity_pct` and `leaf_wetness_pct` feed the disease early-warning model directly.
- While the node reports, the backend learns the correction between the device and the virtual sensor. The calibrated virtual sensor keeps working if the node goes offline.

**MQTT (optional):** if the server has `MQTT_URL` set (HiveMQ Cloud, EMQX, Mosquitto), publish the same JSON plus `"key":"avk_…"` to `agrovolt/<node>/telemetry`. Acknowledgements are published to `agrovolt/<node>/ack`.

## Power & reliability

- The node deep-sleeps between samples, which suits a solar-charged 12 V battery.
- Samples are taken every 5 min and uploaded every 15 min.
- Up to 48 readings (~4 h) are kept in RTC memory through Wi-Fi or server outages.
- The TLS client uses `setInsecure()` for simplicity. Pin the server certificate for production fleets.
