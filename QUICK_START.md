# AgroVolt AI — Quick Start

## Try it live

https://agrovolt-ai.vercel.app. Log in with a demo account (password `Demo@2026`):

| Account | Shows |
|---|---|
| `farmer@agrovolt.demo` | Odia farmer, Khordha, 5 kW over tomato + turmeric — ledger, disease alerts, Sahayak in Odia |
| `kisan@agrovolt.demo` | Hindi farmer, Cuttack, 3 kW over rice |
| `epc@agrovolt.demo` | Solar EPC partner portal (fleet of both farms, API keys, webhooks) |

The first request after ~15 idle minutes can take up to a minute while the free Render backend wakes up.

## Run locally

Prerequisites: Node 20+, MongoDB (local or Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env            # fill MONGO_URI, JWT_SECRET; add keys you have
npm install
npm run dev                     # http://localhost:5001

# 2. Frontend (new terminal)
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:5001 npm run dev   # http://localhost:3000
```

Useful local settings in `backend/.env`:
- `EMAIL_DRY_RUN=true`: verification codes are printed in the backend log instead of emailed.
- `DISABLE_SCHEDULER=true`: no hourly alert or market jobs.
- Without `GEMINI_API_KEYS`, Sahayak answers with the built-in rule engine. Live data still works.

Seed demo accounts into your database: `node backend/scripts/seedDemo.js --apply`.

## Try a sensor without hardware

1. Settings → Field sensors → Add device → copy the key.
2. Post a reading:
```bash
curl -X POST http://localhost:5001/api/v1/telemetry \
  -H "Content-Type: application/json" -H "X-Device-Key: avk_…" \
  -d '{"soil_moisture_pct":28,"ambient_temp":31,"humidity_pct":88,"power_w":2100,"meter_kwh_total":1520.4}'
```
3. The dashboard tag changes to "Hardware verified" and the reading appears live.

Real hardware: see `hardware/esp32-node/README.md`.
