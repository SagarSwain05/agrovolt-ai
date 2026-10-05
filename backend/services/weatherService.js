'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Weather Service
// Primary source: Open-Meteo (free, no key, real 7-day forecast + irradiance,
// local timezone). OpenWeather is used for the current-conditions label/city
// name when OPENWEATHER_API_KEY is configured.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const WMO_DESCRIPTIONS = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'rime fog', 51: 'light drizzle', 53: 'drizzle', 55: 'dense drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
    71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 81: 'rain showers',
    82: 'violent rain showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

function wmoIcon(code, isDay) {
    const d = isDay ? 'd' : 'n';
    if (code === 0) return `01${d}`;
    if (code <= 2) return `02${d}`;
    if (code === 3) return `04${d}`;
    if (code >= 45 && code <= 48) return `50${d}`;
    if (code >= 51 && code <= 67) return `10${d}`;
    if (code >= 71 && code <= 77) return `13${d}`;
    if (code >= 80 && code <= 82) return `09${d}`;
    if (code >= 95) return `11${d}`;
    return `03${d}`;
}

function key(lat, lon, extra) {
    return `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)},${extra}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cached call with retry; serves the last good value (up to 6 h old) if the upstream is down. */
async function cached(k, fn) {
    const hit = cache.get(k);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const v = await fn();
            cache.set(k, { t: Date.now(), v });
            return v;
        } catch (e) {
            lastErr = e;
            const status = e.response?.status;
            if (status && status < 500 && status !== 429) break; // client error: don't retry
            await sleep(700 * (attempt + 1));
        }
    }
    if (hit && Date.now() - hit.t < 6 * 3600 * 1000) return hit.v;
    throw lastErr;
}

/** Format "2026-10-05T05:41" (already local time) as "5:41 AM" */
function fmtLocalClock(iso) {
    if (!iso) return null;
    const [h, m] = iso.split('T')[1].split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
}

const OM_PARAMS = {
    timezone: 'auto',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,shortwave_radiation,soil_moisture_0_to_1cm',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,shortwave_radiation,direct_radiation,diffuse_radiation,cloud_cover,soil_moisture_0_to_1cm,soil_temperature_0cm',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,shortwave_radiation_sum,sunrise,sunset,et0_fao_evapotranspiration,cloud_cover_mean,relative_humidity_2m_mean',
    forecast_days: 7,
};
// Farms within ~5 km share one weather cell (Open-Meteo's grid is ~1–11 km anyway)
const cell = (v) => Math.round(v * 20) / 20;
const TIERS = [{ past: 14, ttl: 30 * 60e3 }, { past: 92, ttl: 3 * 3600e3 }];
const STALE_OK_MS = 48 * 3600e3;
const inflight = new Map();
const status = { direct: { ok: 0, fail: 0, last: null }, proxy: { ok: 0, fail: 0, last: null }, stale: 0 };

async function fetchOM(lat, lon, pastDays) {
    const params = { ...OM_PARAMS, latitude: lat, longitude: lon, past_days: pastDays };
    try {
        const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', { params, timeout: 15000 });
        status.direct.ok++;
        return data;
    } catch (e) {
        status.direct.fail++; status.direct.last = `${e.response?.status || e.code} ${new Date().toISOString()}`;
        const proxy = process.env.WEATHER_PROXY_URL || 'https://agrovolt-ai.vercel.app/api/om';
        if (!proxy || e.response?.status === 400) throw e;
        // Render shares egress IPs that Open-Meteo throttles (429) — retry through the Vercel edge proxy
        try {
            const { data } = await axios.get(proxy, { params, timeout: 20000, headers: process.env.WEATHER_PROXY_KEY ? { 'x-proxy-key': process.env.WEATHER_PROXY_KEY } : {} });
            status.proxy.ok++;
            return data;
        } catch (e2) {
            status.proxy.fail++; status.proxy.last = `${e2.response?.status || e2.code} ${new Date().toISOString()}`;
            throw e;
        }
    }
}

/** Superset bundle for a tier, from memory → Mongo → network (with stale fallback). */
async function bundle(lat, lon, tier) {
    const k = `om|${cell(lat)},${cell(lon)}|${tier.past}`;
    const mem = cache.get(k);
    if (mem && Date.now() - mem.t < tier.ttl) return mem.v;
    if (inflight.has(k)) return inflight.get(k);
    const p = (async () => {
        let WC = null;
        try { WC = require('../models/WeatherCache'); } catch { /* no db */ }
        const dbHit = WC ? await WC.findOne({ key: k }).lean().catch(() => null) : null;
        if (dbHit && Date.now() - new Date(dbHit.fetchedAt).getTime() < tier.ttl) {
            cache.set(k, { t: new Date(dbHit.fetchedAt).getTime(), v: dbHit.data });
            return dbHit.data;
        }
        try {
            const data = await fetchOM(cell(lat), cell(lon), tier.past);
            cache.set(k, { t: Date.now(), v: data });
            if (WC) WC.updateOne({ key: k }, { data, fetchedAt: new Date() }, { upsert: true }).catch(() => { });
            return data;
        } catch (e) {
            const stale = mem?.v ? { t: mem.t, v: mem.v } : dbHit ? { t: new Date(dbHit.fetchedAt).getTime(), v: dbHit.data } : null;
            if (stale && Date.now() - stale.t < STALE_OK_MS) { status.stale++; return stale.v; }
            throw e;
        }
    })().finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
}

/** Restrict a bundle to `pastDays` of history + the forecast (callers index day 0 as the first returned day). */
function sliceBundle(data, pastDays) {
    const today = data.current?.time?.slice(0, 10);
    const di = data.daily.time.indexOf(today);
    if (di < 0) return data;
    const from = Math.max(0, di - pastDays);
    const firstDay = data.daily.time[from];
    const hi = data.hourly.time.findIndex((t) => t.startsWith(firstDay));
    const sl = (obj, start) => Object.fromEntries(Object.entries(obj).map(([key, v]) => [key, Array.isArray(v) ? v.slice(start) : v]));
    return { ...data, daily: sl(data.daily, from), hourly: sl(data.hourly, Math.max(0, hi)) };
}

/**
 * Open-Meteo bundle: current, hourly and daily for `pastDays` of history + 7 forecast days.
 * Backed by two shared tiers (14 and 92 days) so every feature reuses the same few requests.
 */
async function getOpenMeteo(lat, lon, pastDays = 0) {
    const tier = TIERS.find((t) => pastDays <= t.past) || TIERS[TIERS.length - 1];
    const data = await bundle(lat, lon, tier);
    return sliceBundle(data, Math.min(pastDays, tier.past));
}

async function getCityName(lat, lon) {
    return cached(key(lat, lon, 'city'), async () => {
        try {
            if (process.env.OPENWEATHER_API_KEY) {
                const { data } = await axios.get('https://api.openweathermap.org/geo/1.0/reverse', {
                    params: { lat, lon, limit: 1, appid: process.env.OPENWEATHER_API_KEY }, timeout: 6000,
                });
                if (data?.[0]?.name) return cleanPlace(data[0].name);
            }
        } catch { /* fall through */ }
        try {
            const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: { lat, lon, format: 'json', zoom: 10 },
                headers: { 'User-Agent': 'AgroVolt-AI/1.0 (agrovolt-ai.vercel.app)' },
                timeout: 6000,
            });
            const a = data?.address || {};
            const name = a.city || a.town || a.village || a.suburb || a.county || a.state_district || null;
            return name ? cleanPlace(name) : null;
        } catch { /* fall through */ }
        return null;
    });
}

async function getCurrent(lat, lon) {
    const [om, city] = await Promise.all([getOpenMeteo(lat, lon), getCityName(lat, lon)]);
    const c = om.current;
    const today = om.daily;
    const clouds = Math.round(c.cloud_cover ?? 0);
    return {
        temperature: Math.round(c.temperature_2m),
        feelsLike: Math.round(c.apparent_temperature),
        humidity: Math.round(c.relative_humidity_2m),
        windSpeed: Math.round(c.wind_speed_10m),
        description: WMO_DESCRIPTIONS[c.weather_code] || 'clear sky',
        weatherCode: c.weather_code,
        icon: wmoIcon(c.weather_code, c.is_day),
        isDay: !!c.is_day,
        clouds,
        pressure: Math.round(c.pressure_msl),
        precipitation: c.precipitation,
        irradiance: Math.round(c.shortwave_radiation ?? 0), // W/m² right now
        soilMoisture: c.soil_moisture_0_to_1cm != null ? Math.round(c.soil_moisture_0_to_1cm * 1000) / 10 : null, // % vol
        sunrise: fmtLocalClock(today.sunrise?.[0]),
        sunset: fmtLocalClock(today.sunset?.[0]),
        timezone: om.timezone,
        utcOffsetSeconds: om.utc_offset_seconds,
        location: city || om.timezone?.split('/')[1]?.replace('_', ' ') || 'Your farm',
        source: 'Open-Meteo',
        solarImpact: {
            cloudCover: clouds,
            estimatedEfficiency: Math.max(50, Math.round(100 - clouds * 0.4)),
            recommendation: clouds > 70
                ? 'High cloud cover — solar output reduced. Focus on crop tasks.'
                : 'Good solar conditions — panels operating near peak efficiency.',
        },
    };
}

async function getForecast(lat, lon) {
    const [om, city] = await Promise.all([getOpenMeteo(lat, lon), getCityName(lat, lon)]);
    const d = om.daily;
    const forecast = d.time.map((date, i) => {
        const clouds = Math.round(d.cloud_cover_mean?.[i] ?? 0);
        return {
            date,
            day: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
            tempMax: Math.round(d.temperature_2m_max[i]),
            tempMin: Math.round(d.temperature_2m_min[i]),
            humidity: Math.round(d.relative_humidity_2m_mean?.[i] ?? 0),
            clouds,
            rain: d.precipitation_sum[i],
            rainChance: d.precipitation_probability_max?.[i] ?? null,
            description: WMO_DESCRIPTIONS[d.weather_code[i]] || 'clear sky',
            icon: wmoIcon(d.weather_code[i], 1),
            radiationKwhM2: Math.round((d.shortwave_radiation_sum[i] / 3.6) * 100) / 100, // MJ/m² → kWh/m² (= peak sun hours)
            et0: d.et0_fao_evapotranspiration?.[i],
            sunrise: fmtLocalClock(d.sunrise[i]),
            sunset: fmtLocalClock(d.sunset[i]),
            solarEfficiency: Math.max(50, Math.round(100 - clouds * 0.4)),
        };
    });
    return { forecast, city: city || null, source: 'Open-Meteo' };
}

/** Derive actionable alerts from the real forecast (heat, heavy rain, low sun). */
async function getAlerts(lat, lon) {
    const { forecast } = await getForecast(lat, lon);
    const alerts = [];
    forecast.forEach((f, i) => {
        const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : f.day;
        if (f.tempMax >= 38) alerts.push({ type: 'heat', severity: f.tempMax >= 42 ? 'high' : 'medium', date: f.date, value: f.tempMax,
            title: 'Heatwave', message: `Max ${f.tempMax}°C ${when}. Irrigate early morning to cool panels and protect crops.` });
        if (f.rain >= 30) alerts.push({ type: 'rain', severity: f.rain >= 65 ? 'high' : 'medium', date: f.date, value: f.rain,
            title: 'Heavy rain', message: `${Math.round(f.rain)} mm rain expected ${when}. Skip irrigation, check field drainage.` });
        if (f.radiationKwhM2 < 2.5) alerts.push({ type: 'low_sun', severity: 'low', date: f.date, value: f.radiationKwhM2,
            title: 'Low solar day', message: `Only ${f.radiationKwhM2} kWh/m² sunlight ${when}. Expect reduced energy output.` });
    });
    return alerts;
}

module.exports = { getOpenMeteo, getCurrent, getForecast, getAlerts, WMO_DESCRIPTIONS, status: () => status };
