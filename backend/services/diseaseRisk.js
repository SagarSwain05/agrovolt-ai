'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Microclimate disease early warning
// Weather-driven infection-risk rules (hourly RH & temperature, 2 days observed
// + 3 days forecast at the farm; device humidity/leaf wetness override when
// present). Rules follow published epidemiology thresholds:
//  • Late blight (Phytophthora infestans) — tomato/potato: ≥10 consecutive h
//    RH ≥ 90 % at 10–25 °C, or Hutton criteria (2 consecutive days, Tmin ≥ 10 °C
//    and ≥ 6 h RH ≥ 90 %).
//  • Early blight (Alternaria solani): ≥ 8 h RH ≥ 90 % at 24–30 °C.
//  • Rice blast (Magnaporthe oryzae): ≥ 10 h RH ≥ 90 % with night temp 20–26 °C.
//  • Sheath blight (rice): RH ≥ 95 % for ≥ 8 h at 28–32 °C.
//  • Downy/powdery mildews & leaf spots (generic fungal): ≥ 12 h RH ≥ 85 % at 15–28 °C.
//  • Rhizome rot (turmeric/ginger): ≥ 50 mm rain in 72 h (waterlogging).
// ═══════════════════════════════════════════════════════════════════════════
const weather = require('./weatherService');

const RULES = [
    { id: 'late_blight', crops: ['tomato', 'potato'], kind: 'run', rh: 90, tmin: 10, tmax: 25, hours: 10, high: 14 },
    { id: 'early_blight', crops: ['tomato', 'potato', 'chili'], kind: 'run', rh: 90, tmin: 24, tmax: 30, hours: 8, high: 12 },
    { id: 'rice_blast', crops: ['rice'], kind: 'run', rh: 90, tmin: 20, tmax: 26, hours: 10, high: 14 },
    { id: 'sheath_blight', crops: ['rice'], kind: 'run', rh: 95, tmin: 28, tmax: 32, hours: 8, high: 12 },
    { id: 'fungal_leaf', crops: ['*'], kind: 'run', rh: 85, tmin: 15, tmax: 28, hours: 12, high: 18 },
    { id: 'rhizome_rot', crops: ['turmeric', 'ginger'], kind: 'rain', mm: 50, hoursWindow: 72 },
];

/** Longest run of consecutive hours meeting rh/temp limits, with its time window. */
function longestRun(series, rule) {
    let best = { len: 0 }, cur = null;
    for (const h of series) {
        const ok = h.rh >= rule.rh && h.t >= rule.tmin && h.t <= rule.tmax;
        if (ok) { cur = cur ? { ...cur, len: cur.len + 1, end: h.time } : { len: 1, start: h.time, end: h.time }; if (cur.len > best.len) best = cur; }
        else cur = null;
    }
    return best;
}

/** Hutton criteria on daily aggregates. */
function hutton(series) {
    const days = {};
    for (const h of series) {
        const d = h.time.slice(0, 10);
        days[d] ||= { tmin: Infinity, wet: 0 };
        days[d].tmin = Math.min(days[d].tmin, h.t);
        if (h.rh >= 90) days[d].wet++;
    }
    const keys = Object.keys(days).sort();
    for (let i = 1; i < keys.length; i++) {
        const a = days[keys[i - 1]], b = days[keys[i]];
        if (a.tmin >= 10 && b.tmin >= 10 && a.wet >= 6 && b.wet >= 6) return { start: keys[i - 1], end: keys[i] };
    }
    return null;
}

function cropsOf(farm, crops = []) {
    const s = new Set([...(crops || []).map((c) => String(c.cropName || c.name || '').toLowerCase()), String(farm.cropUnderPanels || '').toLowerCase()].filter((x) => x && x !== 'general'));
    return [...s];
}

/**
 * @param farm   Farm document
 * @param crops  active Crop docs
 * @param device latest device reading (optional) — humidity overrides the model for the current hour
 */
async function assess(farm, crops = [], device = null) {
    const { latitude: lat, longitude: lon } = farm.location;
    const om = await weather.getOpenMeteo(lat, lon, 2);
    const nowIso = om.current.time.slice(0, 13);
    const series = om.hourly.time.map((time, i) => ({
        time, t: om.hourly.temperature_2m[i], rh: om.hourly.relative_humidity_2m?.[i] ?? 0, rain: om.hourly.precipitation?.[i] || 0,
        forecast: time.slice(0, 13) > nowIso,
    })).filter((h) => h.t != null);
    // Physical sensor wins for the current hour
    if (device?.humidityPct != null) {
        const cur = series.find((h) => h.time.slice(0, 13) === nowIso);
        if (cur) { cur.rh = device.humidityPct; if (device.ambientTempC != null) cur.t = device.ambientTempC; }
    }
    if (device?.leafWetnessPct >= 50) {
        const cur = series.find((h) => h.time.slice(0, 13) === nowIso);
        if (cur) cur.rh = Math.max(cur.rh, 95);
    }

    const farmCrops = cropsOf(farm, crops);
    const results = [];
    for (const rule of RULES) {
        const applies = rule.crops.includes('*') || rule.crops.some((c) => farmCrops.includes(c));
        if (!applies) continue;
        if (rule.kind === 'run') {
            const run = longestRun(series, rule);
            let level = run.len >= rule.high ? 'high' : run.len >= rule.hours ? 'medium' : null;
            let basis = run.len ? `${run.len} h RH≥${rule.rh}% at ${rule.tmin}–${rule.tmax}°C` : null;
            if (rule.id === 'late_blight') {
                const h = hutton(series);
                if (h && level !== 'high') { level = 'high'; basis = `Hutton period ${h.start}→${h.end}`; }
            }
            if (level) {
                results.push({
                    id: rule.id, level, hours: run.len, window: { start: run.start, end: run.end },
                    forecast: series.find((s) => s.time === run.start)?.forecast || false,
                    crops: rule.crops.includes('*') ? farmCrops : rule.crops.filter((c) => farmCrops.includes(c)),
                    basis,
                });
            }
        } else if (rule.kind === 'rain') {
            let maxMm = 0, at = null;
            for (let i = 0; i < series.length; i++) {
                const w = series.slice(i, i + rule.hoursWindow).reduce((s, h) => s + h.rain, 0);
                if (w > maxMm) { maxMm = w; at = series[i].time; }
            }
            if (maxMm >= rule.mm) results.push({ id: rule.id, level: maxMm >= rule.mm * 1.6 ? 'high' : 'medium', rainMm: Math.round(maxMm), window: { start: at }, crops: rule.crops.filter((c) => farmCrops.includes(c)), basis: `${Math.round(maxMm)} mm in 72 h` });
        }
    }
    const order = { high: 0, medium: 1 };
    results.sort((a, b) => order[a.level] - order[b.level]);
    const maxRh = Math.max(...series.filter((h) => !h.forecast).slice(-24).map((h) => h.rh));
    return { crops: farmCrops, risks: results, observedMaxRh24h: Number.isFinite(maxRh) ? maxRh : null, source: device?.humidityPct != null ? 'device+forecast' : 'forecast' };
}

module.exports = { assess, RULES };
