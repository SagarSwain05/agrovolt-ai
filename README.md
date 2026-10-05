# AgroVolt AI — Bio-Solar Intelligence Platform 🌾⚡

*Powering Fields, Feeding Futures.* An agrivoltaic operating system for small farmers: solar panels and shade-tolerant crops on the same land, with live advice in **English, हिन्दी and ଓଡ଼ିଆ** — on screen and by voice.

**Live:** https://agrovolt-ai.vercel.app · **API:** https://agrovolt-backend.onrender.com/health

Team Quantum Quirtz · AI for Bharat Hackathon

---

## Demo accounts

| Role | Email | Password | What to look at |
|---|---|---|---|
| Farmer (ଓଡ଼ିଆ) | `farmer@agrovolt.demo` | `Demo@2026` | Khordha, 5 kW over tomato + turmeric; 75 days of ledger, disease alerts, Sahayak in Odia |
| Farmer (हिन्दी) | `kisan@agrovolt.demo` | `Demo@2026` | Cuttack, 3 kW over rice; Hindi UI and voice |
| Solar EPC | `epc@agrovolt.demo` | `Demo@2026` | Partner portal with both farms linked (code `EPC-DEMO01`), API keys, webhooks |

Recreate them with `node backend/scripts/seedDemo.js --apply`. The script removes every `@agrovolt.test` account, recreates the demo accounts, and rebuilds their ledgers from real weather. Demo addresses never receive email.

## What works today

| Module | What it does | Data source |
|---|---|---|
| **Dashboard** | Today's solar income, live power, water saved, carbon credits, prioritised "what to do now" actions (spoken on tap), live field sensors, 7-day forecast, 30-day energy chart | Everything below |
| **Sahayak voice assistant** | Voice or text chat in EN/HI/OR. Answers from the farm's live data. Hands-free conversation mode. | Gemini (if `GEMINI_API_KEY` set) else a multilingual rule engine on live data |
| **Solar** | Live power, hourly power curve, bio-cooling, 7-day generation forecast, **Sun-Chaser tilt tool** (phone gyroscope as inclinometer + AR camera guide, saves the measured tilt) | Open-Meteo irradiance + physics model |
| **Energy & carbon ledger** | One row per day from the installation date: kWh, ₹, panel temp, bio-cooling gain, water saved, CO₂ avoided; one idempotent carbon-credit accrual per completed day | Open-Meteo (up to 92 days back), CEA grid factor 0.82 kg/kWh |
| **Carbon wallet** | Balance, hashed ledger, price forecast, sell to ESG buyers at their bid, issue certificates with a **public verification page** (`/verify/<id>`) | Ledger |
| **Market** | Mandi prices, net-of-transport ranking (geocoded distance from the farm), Holt-Winters forecast, sell/wait advice | data.gov.in Agmarknet live API (cached 6 h, accumulated into MongoDB), falls back to a labelled snapshot |
| **Crops** | Shade-aware recommendations, add to farm, crop calendar with growth stage and days to harvest | Recommender + live weather |
| **Scan Hub** | Crop disease (PlantDoc) and panel defect detection, organic-first treatment, scan history, "listen" to diagnosis | Roboflow serverless models |
| **Profit** | Solar + crop + carbon dual income, monthly chart, what-if simulator (extra kW, tariff, payback) | Ledger, crops, market |
| **Reports** | Season report: 92-day climate, risks, best crops with price outlook, solar & disease summary; printable, spoken | Open-Meteo, recommender, forecaster |
| **Subsidies** | PM-KUSUM A/B/C + ICAR pilot eligibility evaluated against the farm profile and a short questionnaire; deadlines respected | `pmkusum_schemes.json` |
| **IoT (Phase 2)** | Register ESP32/LoRaWAN nodes, per-device API keys, telemetry ingest, live **Server-Sent Events** stream. Device readings override the weather-driven virtual sensor field by field | `/api/iot/*` |
| **Disease early warning** | Hourly late blight (≥10 h RH≥90 % / Hutton), early blight, rice blast, sheath blight, fungal leaf and rhizome-rot risk from observed + forecast humidity at the farm (device humidity/leaf wetness override); in-app, web push, SMS/WhatsApp alerts in EN/HI/OR | Open-Meteo hourly + sensors |
| **Calibrated virtual sensor** | Soil moisture rescaled to the farm's soil (FAO-56 field capacity / wilting point) → plant-available water; irradiance bias from NASA POWER observed vs modelled; device-vs-virtual corrections learned while hardware reports | FAO-56, NASA POWER, devices |
| **Accounts & email** | Sign-up verification with a 6-digit code emailed through Brevo (EN/HI/OR), forgot/reset password, email alerts (verified addresses, max 4/day/user, global daily cap). Test and demo domains are never emailed | Brevo |
| **Telemetry v1 + hardware** | `POST /api/v1/telemetry` (snake_case), **built-in MQTT broker** at `wss://<backend>/mqtt` (password = device key, per-device topic isolation), optional external MQTT bridge, `is_hardware_verified`, meter-register → metered ledger days, open-source ESP32 + RS485/Modbus node (`hardware/esp32-node`) | Devices |
| **Carbon MRV & PoA** | Audit export (PDF / daily CSV / hourly CSV / JSON) with baseline EF, formulas, provenance, tilt history, SHA-256; Programme-of-Activities bundle of farms | Ledger, telemetry |
| **Partner portal (Phase 4)** | EPC/FPO accounts, farmer↔partner link codes, fleet health (PR, tilt compliance, soiling, device status), white-label `/api/partner/v1` with keys + HMAC-signed webhooks | All engines |
| **Offline-first PWA** | Installable app, cached pages & last data, daily task checklist offline, offline scan queue (IndexedDB → syncs on reconnect), optional offline Odia voice | Service worker |
| **Crowd mandi prices** | Farmers/FPOs report prices; used (median, labelled) while Agmarknet is down; live feed retried every 30 min | Reports + Agmarknet |
| **District intelligence (Phase 3)** | Anonymised district/state totals for FPOs and agriculture departments, pest/disease **outbreak radar** (3+ farms with the same disease in 14 days) | Aggregated farms, ledger, scans |

### Voice in three languages

| | English | Hindi | Odia |
|---|---|---|---|
| Speech → text | Browser (Chrome/Edge/Android, `en-IN`) | Browser (`hi-IN`) | Browser (`or-IN`) |
| …fallback (other browsers) | Recorded audio → Gemini | Recorded audio → Gemini | Recorded audio → Gemini |
| Text → speech | Edge neural voice `en-IN-NeerjaNeural` (server) | `hi-IN-SwaraNeural` (server) | **Bhashini** (if `BHASHINI_*` set) → **Gemini TTS** (server, MP3, cached) |
| …fallback | Gemini TTS, browser voice | Gemini TTS, browser voice | On-device Meta MMS-TTS Odia (offline, opt-in download) → transliterated Hindi voice |

## Architecture

```
Next.js 16 (Vercel) ── REST + SSE ──> Express 5 (Render) ──> MongoDB Atlas
   │  i18n (EN/HI/OR)                    ├─ services/weatherService   (Open-Meteo, retries, cache)
   │  Sahayak (Web Speech, ORT-web)      ├─ services/energyLedger     (daily kWh/₹/water/CO₂ + credits)
   │  Sun-Chaser (DeviceOrientation)     ├─ services/virtualNode      (sensor readings from live weather)
   │                                     ├─ services/agmarknetLive    (data.gov.in, 6 h cache)
   │                                     ├─ services/farmContext      (snapshot + prioritised actions)
   │                                     ├─ services/llm, tts, i18n   (Gemini, Edge voices, EN/HI/OR text)
   │                                     └─ Roboflow (scan), NASA POWER, Nominatim
   └─ /models/mms-tts-ory (Odia TTS, ONNX)
ESP32 / LoRaWAN ── POST /api/iot/telemetry (X-Device-Key) ──┘
```

## Run locally

```bash
# backend (port 5001 by default)
cd backend && npm install && npm run dev
# frontend
cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:5001 npm run dev
```

### Backend environment (`backend/.env`, Render dashboard)

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI`, `JWT_SECRET` | yes | Database, auth |
| `ROBOFLOW_API_KEY`, `ROBOFLOW_MODEL_ID` | for Scan Hub | Disease / panel detection |
| `AGMARKNET_API_KEY` | for live mandi prices | data.gov.in |
| `GEMINI_API_KEYS` | optional (comma-separated pool) | Conversational Sahayak, server speech recognition, Odia TTS, translation. Models tried: `gemini-3.5-flash-lite` → `3.1-flash-lite` → `flash-lite-latest` → `3.8-flash`; 503/429 pairs cool down |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for web push | Phone notifications |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | for email | Verification codes, password reset, email alerts (`EMAIL_DRY_RUN=true` logs instead of sending) |
| `WEATHER_PROXY_URL`, `WEATHER_PROXY_KEY` | recommended | Vercel relay used when Open-Meteo throttles Render's shared IPs |
| `MQTT_BROKER` | optional | `off` disables the built-in `/mqtt` broker |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | optional (not used now) | SMS / WhatsApp alerts; hidden in the UI unless configured |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE` | optional | WhatsApp Cloud API alerts |
| `BHASHINI_USER_ID`, `BHASHINI_API_KEY` | optional | Govt. Bhashini Odia/Hindi TTS (commercial-friendly) |
| `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` | optional | Also subscribe to an external broker (HiveMQ/EMQX) |
| `GRID_EF_KG_PER_KWH`, `GRID_EF_SOURCE` | optional | Override the MRV baseline emission factor |
| `DISABLE_SCHEDULER` | optional | Turn off background alert/market/ledger jobs (local dev) |
| `OPENWEATHER_API_KEY` | optional | Place names |
| `FRONTEND_URL` | yes in prod | Certificate verification links |
| `MONGO_DB_NAME` | optional | Override DB name (e.g. a test database) |

### IoT device example

```bash
curl -X POST https://agrovolt-backend.onrender.com/api/iot/telemetry \
  -H "Content-Type: application/json" -H "X-Device-Key: avk_…" \
  -d '{"soilMoisturePct":31.5,"soilN":210,"soilP":18,"soilK":160,"panelTempC":47.2,"powerW":2150}'
```
Fields: `ambientTempC underCanopyTempC humidityPct panelTempC irradianceWm2 lux parCrop soilMoisturePct soilTempC soilN soilP soilK soilPH powerW energyTodayKwh panelTiltDeg ts`. Batch with `{"readings":[…]}`. Keys are created in **Settings → Field sensors**.

## Honest limits

- **Energy, water and carbon numbers are modelled** from real weather at the farm's coordinates plus the farm's configuration until a meter/sensor is connected. Rows from a physical device are never overwritten.
- **Carbon credits** are calculated, hashed and certificate-verifiable inside AgroVolt; selling for money still needs registry verification (Verra / Gold Standard / India CCTS).
- **Agmarknet**: when data.gov.in is unreachable the market page says so and shows the dated snapshot.
- **Odia voice licensing**: server voices (Bhashini, Gemini TTS) are the default path for paid tiers. The optional offline Meta MMS-TTS model is **CC-BY-NC 4.0** — keep it as a free-tier/offline convenience or replace it before charging for offline voice.
- Render's free tier sleeps; `.github/workflows/keepalive.yml` pings it every 10 minutes.

## Roadmap status (from the pitch deck)

| Phase | Status |
|---|---|
| 1 · Odisha pilot software (dashboard, voice EN/HI/OR, scan, solar, market, carbon) | ✅ built |
| 2 · IoT bridge (ESP32/LoRaWAN ingest, MQTT, live stream, device keys, calibration, open-source firmware) | ✅ built; firmware compiles, needs field hardware |
| 3 · State/district dashboards, outbreak radar, verifiable carbon | ✅ built |
| 4 · Solar EPC/OEM bundling | ✅ partner portal, white-label API, webhooks — partnerships to sign |
| 5 · Export to other regions | Languages/schemes are data files; add per region |

## 📧 Contact

- **Email:** sagar23swain@gmail.com
- **Website:** https://agrovolt-ai.vercel.app/
