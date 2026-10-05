# AgroVolt AI — Build, Deploy & Operate

## Topology

| Part | Where | Deploys from |
|---|---|---|
| Frontend (Next.js 16, PWA) | Vercel project `agrovolt-ai` → https://agrovolt-ai.vercel.app | `main` (git integration), root `frontend/` |
| Backend (Express 5 + built-in MQTT broker) | Render `agrovolt-backend` → https://agrovolt-backend.onrender.com | `main` (auto-deploy), root `backend/` (`render.yaml`) |
| Database | MongoDB Atlas (`MONGO_URI` on Render) | — |
| Keep-alive | GitHub Actions `.github/workflows/keepalive.yml` (pings `/health` every 10 min) | — |

Push to `main` and both platforms deploy automatically.

## Environment

- **Backend** (Render → Environment): every variable is listed in `backend/.env.example`. Required: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`. Feature keys: `GEMINI_API_KEYS`, `ROBOFLOW_*`, `AGMARKNET_API_KEY`, `BREVO_API_KEY` + `EMAIL_FROM`, `VAPID_*`, `WEATHER_PROXY_URL` + `WEATHER_PROXY_KEY`.
- **Frontend** (Vercel → Environment): `NEXT_PUBLIC_API_URL=https://agrovolt-backend.onrender.com`, plus `WEATHER_PROXY_KEY`, which must equal the backend value.

## Build checks

```bash
cd frontend && npx tsc --noEmit && npm run build
cd backend && node -e "require('./server.js')"   # boots; Ctrl-C
cd hardware/esp32-node && pio run                 # firmware (copy config.example.h → config.h first)
```

## Health & monitoring

`GET /health` reports database state, assistant engine (`gemini`/`rules`), MQTT broker and bridge counters.
Other diagnostics: `GET /api/assistant/status` (voice and LLM providers), and `GET /api/market/status` (Agmarknet live-feed health, crowd reports; requires login).

## Background jobs (in the API process)

| Job | Interval | Purpose |
|---|---|---|
| Alerts | hourly | Disease-risk, weather and nearby-outbreak notifications (in-app, push, email) + partner webhooks |
| Market | 30 min | Retry the data.gov.in Agmarknet feed; store real prices |
| Ledgers | 6 h | Refresh energy/carbon ledgers for solar farms |

## API map

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/{register,login,verify-email,resend-code,forgot-password,reset-password}`, `GET /api/auth/me` |
| Farm | `GET/PUT /api/farm`, `PUT /api/farm/me`, `GET /api/farm/geocode` |
| Live data | `GET /api/dashboard`, `/api/dashboard/profit`, `/api/iot/{latest,history,stream}`, `/api/weather/*` |
| Sensors | `POST /api/v1/telemetry` (X-Device-Key), `wss://…/mqtt` (password = device key), `/api/iot/devices` |
| Assistant | `POST /api/assistant/{chat,tts,translate}`, `GET /api/assistant/{briefing,status}` |
| Crops / scan | `/api/crop/*`, `POST /api/scan/{crop,panel}`, `/api/disease/history` |
| Solar / market | `/api/solar/{optimize,history}`, `/api/market/{prices,trends,recommend,report,status}` |
| Carbon | `/api/carbon/{wallet,intelligence,history,withdraw,certificate,mrv,poa}`, public `GET /api/carbon/verify/:id` |
| Alerts | `/api/notifications{,/read,/config,/subscribe,/prefs,/test,/risk}` |
| District / schemes / reports | `GET /api/district`, `POST /api/schemes/check`, `GET /api/reports/season` |
| Partners | `/api/epc/{partner,link,fleet,keys}`, white-label `/api/partner/v1/*` (X-Api-Key) |

## Demo data

`node backend/scripts/seedDemo.js` performs a dry run; add `--apply` to delete `@agrovolt.test` accounts and recreate the three demo accounts. To target production, run it with Render's `MONGO_URI` in the environment.
