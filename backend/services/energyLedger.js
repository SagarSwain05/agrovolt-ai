'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Energy & Carbon Ledger
// Converts real daily irradiance/temperature/ET0 (Open-Meteo) at the farm's
// coordinates into one SolarData row per day and one idempotent carbon-credit
// accrual per completed day. Rows written by a physical device are never
// overwritten.
// ═══════════════════════════════════════════════════════════════════════════
const SolarData = require('../models/SolarData');
const CarbonTransaction = require('../models/CarbonTransaction');
const weather = require('./weatherService');
const physics = require('./agrivoltaicPhysics');
const solarPosition = require('../mlModels/solarPosition');

const MAX_BACKFILL_DAYS = 92; // Open-Meteo past_days limit
const THROTTLE_MS = 20 * 60 * 1000;
const lastRun = new Map();

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function startDay(farm, todayStr) {
    const today = new Date(todayStr + 'T00:00:00Z');
    const earliest = new Date(today.getTime() - MAX_BACKFILL_DAYS * 86400000);
    const since = farm.solarSince ? new Date(farm.solarSince) : today;
    return (since > earliest ? since : earliest).toISOString().slice(0, 10);
}

async function ensureLedger(farm, { force = false } = {}) {
    if (!farm?.solarInstalled || !(farm.solarCapacityKW > 0)) return { skipped: 'no-solar' };
    const id = String(farm._id);
    if (!force && lastRun.has(id) && Date.now() - lastRun.get(id) < THROTTLE_MS) return { skipped: 'throttled' };
    lastRun.set(id, Date.now());

    const { latitude: lat, longitude: lon } = farm.location;
    const irrFactor = await require('./calibration').refreshIrradiance(farm);
    const om = await weather.getOpenMeteo(lat, lon, MAX_BACKFILL_DAYS);
    const todayStr = om.current.time.slice(0, 10);
    const nowHour = Number(om.current.time.slice(11, 13));
    const firstDay = startDay(farm, todayStr);

    const optimal = solarPosition.getOptimalTilt(lat, lon);
    const tf = physics.tiltFactor(farm.panelTilt, optimal);
    const d = om.daily;
    const deviceDays = new Set(
        (await SolarData.find({ farmId: farm._id, source: 'device', day: { $gte: firstDay } }).select('day')).map((r) => r.day)
    );

    const solarOps = [];
    const carbonOps = [];
    d.time.forEach((day, i) => {
        if (day < firstDay || day > todayStr || deviceDays.has(day)) return;
        const isPartial = day === todayStr;
        let psh = d.shortwave_radiation_sum[i] / 3.6; // MJ/m² → kWh/m²
        if (isPartial) {
            // Sum hourly irradiance up to the current hour (hourly W/m² mean = Wh/m²)
            psh = om.hourly.time.reduce((s, t, h) => (t.startsWith(day) && Number(t.slice(11, 13)) < nowHour
                ? s + (om.hourly.shortwave_radiation[h] || 0) / 1000 : s), 0);
        }
        if (!Number.isFinite(psh)) return;
        psh *= irrFactor; // NASA POWER-calibrated insolation
        const r = physics.dailyEnergy({
            capacityKW: farm.solarCapacityKW,
            peakSunHours: psh,
            tempMaxC: d.temperature_2m_max[i],
            crop: farm.cropUnderPanels,
            shadeCoveragePct: farm.shadeCoverage ?? 35,
            tiltFactor: tf,
            et0Mm: (d.et0_fao_evapotranspiration[i] || 0) * (isPartial ? Math.min(1, nowHour / 18) : 1),
        });
        const revenue = r.energyKwh * (farm.tariffPerKwh || 6);
        solarOps.push({
            updateOne: {
                filter: { farmId: farm._id, day },
                update: {
                    $set: {
                        date: new Date(day + 'T12:00:00Z'),
                        energyProduced: round(r.energyKwh),
                        efficiency: r.efficiencyPct,
                        panelTemperature: round(r.panelTempC, 1),
                        irradianceKwhM2: round(psh),
                        ambientTempMax: d.temperature_2m_max[i],
                        bioCoolingDeltaC: round(r.bioCoolingDeltaC, 1),
                        bioCoolingGainKwh: round(r.bioCoolingGainKwh),
                        waterSavedLiters: Math.round(r.waterSavedLiters),
                        co2AvoidedKg: round(r.co2AvoidedKg),
                        weatherImpactScore: Math.max(0, Math.min(100, Math.round(100 - (d.cloud_cover_mean?.[i] ?? 0) * 0.6))),
                        revenue: Math.round(revenue),
                        isPartial,
                        source: 'model',
                    },
                },
                upsert: true,
            },
        });
        if (!isPartial) {
            carbonOps.push({
                updateOne: {
                    filter: { farmId: farm._id, sourceDay: day },
                    update: {
                        $setOnInsert: {
                            userId: farm.userId,
                            transactionType: 'earned',
                            creditsEarned: round(r.co2AvoidedKg / 1000, 4),
                            co2ReducedKg: round(r.co2AvoidedKg),
                            waterSavedLiters: Math.round(r.waterSavedLiters),
                            monetaryValue: round((r.co2AvoidedKg / 1000) * physics.CREDIT_PRICE_INR),
                            description: `Solar generation ${round(r.energyKwh, 1)} kWh on ${day}`,
                            timestamp: new Date(day + 'T18:00:00Z'),
                        },
                    },
                    upsert: true,
                },
            });
        }
    });

    if (solarOps.length) await SolarData.bulkWrite(solarOps, { ordered: false });
    if (carbonOps.length) await CarbonTransaction.bulkWrite(carbonOps, { ordered: false });
    return { days: solarOps.length, credited: carbonOps.length, from: firstDay, to: todayStr };
}

/** Forget throttle state, e.g. after the farm's solar configuration changes. */
function invalidate(farmId) {
    lastRun.delete(String(farmId));
}

module.exports = { ensureLedger, invalidate };
