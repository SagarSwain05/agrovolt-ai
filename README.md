# AgroVolt AI — Bio-Solar Intelligence Platform 🌾⚡

*Powering Fields, Feeding Futures.* An agrivoltaic operating system for small farmers: solar panels and shade-tolerant crops on the same land, with live advice in **English, हिन्दी and ଓଡ଼ିଆ** — on screen and by voice.

**Live:** https://agrovolt-ai.vercel.app · **API:** https://agrovolt-backend.onrender.com/health

Team Quantum Quirtz · AI for Bharat Hackathon

---

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
| **District intelligence (Phase 3)** | Anonymised district/state totals for FPOs and agriculture departments, pest/disease **outbreak radar** (3+ farms with the same disease in 14 days) | Aggregated farms, ledger, scans |

### Voice in three languages

| | English | Hindi | Odia |
|---|---|---|---|
| Speech → text | Browser (Chrome/Edge/Android, `en-IN`) | Browser (`hi-IN`) | Browser (`or-IN`) |
| …fallback (other browsers) | Recorded audio → Gemini | Recorded audio → Gemini | Recorded audio → Gemini |
| Text → speech | Edge neural voice `en-IN-NeerjaNeural` (server) | `hi-IN-SwaraNeural` (server) | **Meta MMS-TTS Odia running in the browser** (ONNX, 38 MB, cached; numbers spoken in Odia words) |
| …fallback | Browser voice | Browser voice | Odia→Devanagari transliteration read by the Hindi voice |

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
| `GEMINI_API_KEY` | optional (free at aistudio.google.com) | Conversational Sahayak + server speech recognition |
| `GEMINI_MODEL` | optional | Default `gemini-2.5-flash` |
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
- **Odia TTS model** (Meta MMS) is licensed **CC-BY-NC 4.0** — fine for the pilot, replace (e.g. AI4Bharat Indic-TTS or a licensed API) before paid tiers.
- Render's free tier sleeps; `.github/workflows/keepalive.yml` pings it every 10 minutes.

## Roadmap status (from the pitch deck)

| Phase | Status |
|---|---|
| 1 · Odisha pilot software (dashboard, voice EN/HI/OR, scan, solar, market, carbon) | ✅ built |
| 2 · IoT bridge (ESP32/LoRaWAN ingest, live stream, device keys) | ✅ API + UI built; needs hardware |
| 3 · State/district dashboards, outbreak radar, verifiable carbon | ✅ built |
| 4 · Solar OEM bundling | Business partnership — API ready to embed |
| 5 · Export to other regions | Languages/schemes are data files; add per region |

## 📧 Contact

- **Email:** sagar23swain@gmail.com
- **Website:** https://agrovolt-ai.vercel.app/
