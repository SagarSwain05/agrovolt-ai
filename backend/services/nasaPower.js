'use strict';
// NASA POWER (free, no key). Daily all-sky irradiance, temperature, rainfall.
// Data lags a few days, so callers should treat it as historical ground truth.
const axios = require('axios');

const cache = new Map();
const TTL = 6 * 3600 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

async function getRecentRadiation(lat, lon, days = 14) {
    const k = `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;
    const hit = cache.get(k);
    if (hit && Date.now() - hit.t < TTL) return hit.v;

    const end = new Date(Date.now() - 86400000);
    const start = new Date(Date.now() - days * 86400000);
    const { data } = await axios.get('https://power.larc.nasa.gov/api/temporal/daily/point', {
        params: {
            parameters: 'ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M,PRECTOTCORR',
            community: 'AG', latitude: lat, longitude: lon,
            start: ymd(start), end: ymd(end), format: 'JSON',
        },
        timeout: 20000,
    });
    const p = data?.properties?.parameter || {};
    const fill = data?.header?.fill_value ?? -999;
    const radiation = Object.keys(p.ALLSKY_SFC_SW_DWN || {})
        .map((date) => ({
            date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
            // AG community reports MJ/m²/day → convert to kWh/m²/day (= peak sun hours)
            solarRadiation: Math.round((p.ALLSKY_SFC_SW_DWN[date] / 3.6) * 100) / 100,
            clearSkyRadiation: p.CLRSKY_SFC_SW_DWN?.[date] > fill ? Math.round((p.CLRSKY_SFC_SW_DWN[date] / 3.6) * 100) / 100 : null,
            temperature: p.T2M?.[date],
            precipitation: p.PRECTOTCORR?.[date],
        }))
        .filter((r) => r.solarRadiation > 0);
    const v = {
        location: { lat, lon },
        radiation,
        avgRadiation: radiation.length
            ? Math.round((radiation.reduce((s, r) => s + r.solarRadiation, 0) / radiation.length) * 100) / 100
            : null,
        unit: 'kWh/m²/day',
        source: 'NASA POWER',
    };
    cache.set(k, { t: Date.now(), v });
    return v;
}

module.exports = { getRecentRadiation };
