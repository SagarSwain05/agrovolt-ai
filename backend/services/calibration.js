'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Virtual-sensor calibration
// 1. Soil: rescale Open-Meteo's generic soil moisture into the farm's soil
//    hydraulic range (FAO-56 field capacity / wilting point) and derive
//    plant-available water (PAW %).
// 2. Irradiance: NASA POWER observed insolation ÷ Open-Meteo modelled for the
//    same days at the farm → bias factor used by the energy model.
// 3. Device learning: when a physical sensor reports, learn the measured vs
//    virtual difference (EMA) and apply it while the device is offline.
// ═══════════════════════════════════════════════════════════════════════════
const hydraulics = require('../data/soil_hydraulics.json');

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const EMA = 0.15;

function soilParams(soilType) {
    return hydraulics.soils[soilType] || hydraulics.soils.loamy;
}

/** Open-Meteo volumetric % → farm-soil volumetric % + plant-available water %. */
function calibrateSoil(openMeteoPct, soilType) {
    if (openMeteoPct == null || !Number.isFinite(openMeteoPct)) return { vwc: null, paw: null };
    const ref = hydraulics.openMeteoReference;
    const rel = clamp((openMeteoPct - ref.wiltingPoint) / (ref.fieldCapacity - ref.wiltingPoint), -0.2, 1.4);
    const s = soilParams(soilType);
    const vwc = s.wiltingPoint + rel * (s.fieldCapacity - s.wiltingPoint);
    return { vwc: Math.round(vwc * 10) / 10, paw: Math.round(clamp(rel, 0, 1.2) * 100), fieldCapacity: s.fieldCapacity, wiltingPoint: s.wiltingPoint };
}

/** PAW % from a measured volumetric reading. */
function pawFromVwc(vwc, soilType) {
    const s = soilParams(soilType);
    return Math.round(clamp((vwc - s.wiltingPoint) / (s.fieldCapacity - s.wiltingPoint), 0, 1.2) * 100);
}

/** Refresh the irradiance bias (at most daily). Needs ≥5 overlapping days. */
async function refreshIrradiance(farm) {
    const c = farm.calibration || {};
    if (c.irradianceUpdatedAt && Date.now() - new Date(c.irradianceUpdatedAt).getTime() < 24 * 3600e3) return c.irradianceFactor || 1;
    try {
        const nasa = require('./nasaPower');
        const weather = require('./weatherService');
        const { latitude: lat, longitude: lon } = farm.location;
        const [n, om] = await Promise.all([nasa.getRecentRadiation(lat, lon, 21), weather.getOpenMeteo(lat, lon, 30)]);
        const omByDay = Object.fromEntries(om.daily.time.map((d, i) => [d, om.daily.shortwave_radiation_sum[i] / 3.6]));
        let so = 0, sm = 0, days = 0;
        for (const r of n.radiation) {
            const m = omByDay[r.date];
            if (m > 0.5 && r.solarRadiation > 0.5) { so += r.solarRadiation; sm += m; days++; }
        }
        const factor = days >= 5 ? clamp(so / sm, 0.8, 1.2) : 1;
        farm.calibration = { ...(farm.calibration?.toObject?.() || farm.calibration || {}), irradianceFactor: Math.round(factor * 1000) / 1000, irradianceDays: days, irradianceUpdatedAt: new Date() };
        await farm.save().catch(() => { });
        return factor;
    } catch (e) {
        console.error('[calibration] irradiance:', e.message);
        return c.irradianceFactor || 1;
    }
}

/** Learn device-vs-virtual corrections (called on hardware ingest). */
function learn(farm, measured, virtual) {
    if (!virtual) return false;
    const c = { ...(farm.calibration?.toObject?.() || farm.calibration || {}) };
    let changed = false;
    if (measured.soilMoisturePct > 1 && virtual.soilMoisturePct > 1) {
        const r = clamp(measured.soilMoisturePct / virtual.soilMoisturePct, 0.3, 3);
        c.soilMoistureFactor = (c.soilMoistureFactor || 1) * (1 - EMA) + r * EMA; changed = true;
    }
    if (measured.panelTempC != null && virtual.panelTempC != null) {
        const d = clamp(measured.panelTempC - virtual.panelTempC, -20, 20);
        c.panelTempOffset = (c.panelTempOffset || 0) * (1 - EMA) + d * EMA; changed = true;
    }
    if (measured.powerW > 50 && virtual.powerW > 200) {
        const r = clamp(measured.powerW / virtual.powerW, 0.3, 1.8);
        c.powerFactor = (c.powerFactor || 1) * (1 - EMA) + r * EMA; changed = true;
    }
    if (changed) {
        c.samples = (c.samples || 0) + 1;
        for (const k of ['soilMoistureFactor', 'panelTempOffset', 'powerFactor']) if (c[k] != null) c[k] = Math.round(c[k] * 1000) / 1000;
        farm.calibration = c;
    }
    return changed;
}

/** Apply learned device corrections to a virtual reading. */
function applyLearned(reading, farm) {
    const c = farm.calibration || {};
    if (!c.samples) return reading;
    const r = { ...reading };
    if (r.soilMoisturePct != null && c.soilMoistureFactor) r.soilMoisturePct = Math.round(r.soilMoisturePct * c.soilMoistureFactor * 10) / 10;
    if (r.panelTempC != null && c.panelTempOffset) r.panelTempC = Math.round((r.panelTempC + c.panelTempOffset) * 10) / 10;
    if (r.powerW != null && c.powerFactor) r.powerW = Math.round(r.powerW * c.powerFactor);
    return r;
}

module.exports = { calibrateSoil, pawFromVwc, refreshIrradiance, learn, applyLearned, soilParams };
