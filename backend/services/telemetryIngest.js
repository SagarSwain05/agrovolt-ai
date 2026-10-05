'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Telemetry ingest (shared by HTTP /api/v1/telemetry, the legacy
// /api/iot/telemetry route and the MQTT bridge).
//
// Payload (snake_case or camelCase, any subset):
//   { farmId?, ts?, energy_kwh, meter_kwh_total, power_w, soil_moisture_pct,
//     soil_temp, ambient_temp, humidity_pct, panel_temp, irradiance_wm2, lux,
//     soil_n, soil_p, soil_k, soil_ph, voltage_v, current_a, leaf_wetness_pct,
//     rain_mm, tilt_deg }
// Batches: { readings: [ … ] }
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const Device = require('../models/Device');
const Farm = require('../models/Farm');
const Telemetry = require('../models/Telemetry');
const SolarData = require('../models/SolarData');
const TiltLog = require('../models/TiltLog');
const calibration = require('./calibration');
const physics = require('./agrivoltaicPhysics');

const FIELD_MAP = {
    energy_kwh: 'energyTodayKwh', energyTodayKwh: 'energyTodayKwh', energy_today_kwh: 'energyTodayKwh',
    meter_kwh_total: 'meterKwhTotal', energy_kwh_total: 'meterKwhTotal', meterKwhTotal: 'meterKwhTotal',
    power_w: 'powerW', powerW: 'powerW',
    soil_moisture_pct: 'soilMoisturePct', soilMoisturePct: 'soilMoisturePct',
    soil_temp: 'soilTempC', soil_temp_c: 'soilTempC', soilTempC: 'soilTempC',
    ambient_temp: 'ambientTempC', ambient_temp_c: 'ambientTempC', ambientTempC: 'ambientTempC',
    under_canopy_temp: 'underCanopyTempC', underCanopyTempC: 'underCanopyTempC',
    humidity_pct: 'humidityPct', humidityPct: 'humidityPct',
    panel_temp: 'panelTempC', panel_temp_c: 'panelTempC', panelTempC: 'panelTempC',
    irradiance_wm2: 'irradianceWm2', irradianceWm2: 'irradianceWm2',
    lux: 'lux', par: 'parCrop', parCrop: 'parCrop',
    soil_n: 'soilN', soilN: 'soilN', soil_p: 'soilP', soilP: 'soilP', soil_k: 'soilK', soilK: 'soilK',
    soil_ph: 'soilPH', soilPH: 'soilPH',
    voltage_v: 'voltageV', voltageV: 'voltageV', current_a: 'currentA', currentA: 'currentA',
    leaf_wetness_pct: 'leafWetnessPct', leafWetnessPct: 'leafWetnessPct',
    rain_mm: 'rainMm', rainMm: 'rainMm',
    tilt_deg: 'panelTiltDeg', panelTiltDeg: 'panelTiltDeg',
};
const RANGES = {
    soilMoisturePct: [0, 100], humidityPct: [0, 100], leafWetnessPct: [0, 100], ambientTempC: [-20, 65], soilTempC: [-10, 80],
    panelTempC: [-20, 110], underCanopyTempC: [-20, 65], irradianceWm2: [0, 1600], powerW: [0, 5e6], soilPH: [0, 14],
    panelTiltDeg: [0, 90], energyTodayKwh: [0, 1e5], meterKwhTotal: [0, 1e10],
};

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const IST_MS = 5.5 * 3600 * 1000;
const dayOf = (d) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

async function deviceForKey(key) {
    if (!key) return null;
    return Device.findOne({ keyHash: sha256(key), isActive: true });
}

function normalize(r) {
    const doc = {};
    for (const [k, v] of Object.entries(r || {})) {
        const f = FIELD_MAP[k];
        if (!f || v == null || v === '' || !Number.isFinite(Number(v))) continue;
        const n = Number(v);
        const rg = RANGES[f];
        if (rg && (n < rg[0] || n > rg[1])) continue; // drop out-of-range sensor glitches
        doc[f] = n;
    }
    return doc;
}

/** Daily generation from the device: max of energy-today, or meter register delta. */
async function updateDeviceEnergyDay(farm, day) {
    const start = new Date(new Date(day + 'T00:00:00Z').getTime() - IST_MS);
    const end = new Date(start.getTime() + 86400000);
    const rows = await Telemetry.find({ farmId: farm._id, source: 'device', ts: { $gte: start, $lt: end } })
        .select('energyTodayKwh meterKwhTotal ts').sort({ ts: 1 }).lean();
    let kwh = null;
    const today = rows.map((r) => r.energyTodayKwh).filter((v) => v != null);
    if (today.length) kwh = Math.max(...today);
    const meter = rows.map((r) => r.meterKwhTotal).filter((v) => v != null);
    if (kwh == null && meter.length) {
        const prev = await Telemetry.findOne({ farmId: farm._id, source: 'device', ts: { $lt: start }, meterKwhTotal: { $ne: null } }).sort({ ts: -1 }).lean();
        const base = prev?.meterKwhTotal ?? meter[0];
        kwh = Math.max(0, meter[meter.length - 1] - base);
    }
    if (kwh == null) return null;
    const co2 = kwh * physics.GRID_EF_KG_PER_KWH;
    await SolarData.updateOne(
        { farmId: farm._id, day },
        { $set: { date: new Date(day + 'T12:00:00Z'), energyProduced: Math.round(kwh * 100) / 100, revenue: Math.round(kwh * (farm.tariffPerKwh || 6)), co2AvoidedKg: Math.round(co2 * 100) / 100, source: 'device', isPartial: day === dayOf(new Date()) } },
        { upsert: true },
    );
    return kwh;
}

const lastLearn = new Map();

/**
 * @param {object} p  { key, body, farmIdClaim }
 * @returns {{status:number, body:object}}
 */
async function ingest({ key, body }) {
    const device = await deviceForKey(key);
    if (!device) return { status: 401, body: { success: false, message: 'Unknown or missing device key' } };
    if (body?.farmId && String(body.farmId) !== String(device.farmId)) {
        return { status: 403, body: { success: false, message: 'farmId does not match this device' } };
    }
    const batch = Array.isArray(body?.readings) ? body.readings.slice(0, 500) : [body || {}];
    const docs = [];
    for (const r of batch) {
        const d = normalize(r);
        if (!Object.keys(d).length) continue;
        const ts = r.ts ? new Date(typeof r.ts === 'number' && r.ts < 1e12 ? r.ts * 1000 : r.ts) : new Date();
        docs.push({ farmId: device.farmId, deviceId: device._id, source: 'device', ts: isNaN(ts) ? new Date() : ts, ...d });
    }
    if (!docs.length) return { status: 400, body: { success: false, message: 'No recognised numeric fields in payload' } };
    await Telemetry.insertMany(docs);

    const farm = await Farm.findById(device.farmId);
    device.lastSeenAt = new Date();
    await device.save();

    let firstVerification = false;
    if (!farm.isHardwareVerified) {
        farm.isHardwareVerified = true;
        farm.hardwareVerifiedAt = new Date();
        firstVerification = true;
    }

    // Energy meter → device-verified ledger days
    const days = [...new Set(docs.filter((d) => d.energyTodayKwh != null || d.meterKwhTotal != null).map((d) => dayOf(d.ts)))];
    for (const day of days) await updateDeviceEnergyDay(farm, day);

    // Tilt reported by an inclinometer
    const tilt = docs.map((d) => d.panelTiltDeg).filter((v) => v != null).pop();
    if (tilt != null && Math.abs(tilt - (farm.panelTilt ?? tilt)) >= 1) {
        farm.panelTilt = Math.round(tilt);
        TiltLog.create({ farmId: farm._id, tiltDeg: farm.panelTilt, source: 'device' }).catch(() => { });
    }

    // Learn calibration at most every 10 min per farm
    const latest = docs[docs.length - 1];
    if (!lastLearn.has(String(farm._id)) || Date.now() - lastLearn.get(String(farm._id)) > 10 * 60e3) {
        lastLearn.set(String(farm._id), Date.now());
        try {
            const virtual = await require('./virtualNode').read({ ...farm.toObject(), calibration: { irradianceFactor: farm.calibration?.irradianceFactor } });
            calibration.learn(farm, latest, virtual);
        } catch (e) { console.error('[ingest] learn:', e.message); }
    }
    await farm.save();

    require('./events').emit('telemetry', { farmId: String(farm._id), reading: latest });
    return {
        status: 201,
        body: { success: true, accepted: docs.length, rejected: batch.length - docs.length, is_hardware_verified: true, first_verification: firstVerification, device: device.name },
    };
}

module.exports = { ingest, normalize, deviceForKey, FIELD_MAP };
