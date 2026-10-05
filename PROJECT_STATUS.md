# AgroVolt AI — Project Status (October 2026)

Live: https://agrovolt-ai.vercel.app · API: https://agrovolt-backend.onrender.com/health

## Built and running in production

- **Live data on every page**: Open-Meteo forecast and irradiance (shared cache, Mongo persistence, Vercel relay when throttled), NASA POWER calibration, energy and carbon ledger per farm.
- **Three languages, end to end**: UI, advisories, alerts and emails in English, हिन्दी and ଓଡ଼ିଆ.
- **Sahayak voice chat**: Gemini (key pool, model fallback) or a rule engine; browser speech recognition; Edge neural voices for EN/HI; Gemini TTS for Odia, with an optional offline on-device Odia model; sentence-level streaming.
- **Accounts**: email verification and password reset by code (Brevo), farmer / EPC / FPO roles.
- **Sensors**: `/api/v1/telemetry`, a built-in MQTT-over-WSS broker, `is_hardware_verified`, metered ledger days, calibration learned from devices, open-source ESP32 + RS485/Modbus firmware (compiles; not yet field-tested).
- **Disease early warning**: late blight, early blight, rice blast, sheath blight, fungal leaf disease and rhizome rot from hourly microclimate; push, email and in-app alerts.
- **Carbon**: daily accrual, certificates with public verification, MRV export (PDF/CSV/hourly), Programme-of-Activities bundle.
- **Market**: Agmarknet live with 30-min retry, crowd-sourced farmer/FPO prices, Holt-Winters forecast, net-of-transport mandi ranking.
- **Partners**: EPC/FPO fleet dashboard, white-label API, HMAC-signed webhooks.
- **Offline PWA**: installable, cached dashboard and checklist, offline scan queue.

## Known limits

- Energy, water and carbon figures are **modelled** until a meter reports; only metered days count as verifiable credits.
- data.gov.in (Agmarknet) was unreachable at the time of writing; prices fall back to farmer reports plus a dated snapshot.
- Email: Brevo free plan (300/day). SMS/WhatsApp are coded but disabled (no Twilio/Meta account).
- Bhashini TTS adapter is dormant (no keys). The offline Odia model (Meta MMS) is CC-BY-NC — free-tier/offline use only.
- Render free tier: the keep-alive workflow limits cold starts; background jobs run in-process.

## Next steps

1. Field-test the ESP32 node with a real Modbus energy meter and soil probe; tune register maps.
2. Pilot with an FPO/EPC in Khordha; collect metered days for the first PoA submission.
3. Add Bhashini once registration is available; replace the CC-BY-NC offline voice before paid offline tiers.
4. Move background jobs to a dedicated worker if the farm count grows.
