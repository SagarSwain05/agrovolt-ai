'use strict';
const axios = require('axios');
const mongoose = require('mongoose');

// Persistent cache of mandi coordinates (Nominatim allows ~1 req/s, so each mandi is looked up once).
const MandiLocation = mongoose.models.MandiLocation || mongoose.model('MandiLocation', new mongoose.Schema({
    key: { type: String, unique: true },
    lat: Number,
    lon: Number,
    notFound: Boolean,
}, { timestamps: true }));

const mem = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Coordinates for a mandi; `allowFetch` limits fresh Nominatim calls per request. */
async function geocodeMandi(market, district, state, allowFetch = true) {
    const key = `${market}|${district}|${state}`.toLowerCase();
    if (mem.has(key)) return mem.get(key);
    const doc = await MandiLocation.findOne({ key }).lean();
    if (doc) {
        const v = doc.notFound ? null : { lat: doc.lat, lon: doc.lon };
        mem.set(key, v);
        return v;
    }
    if (!allowFetch) return null;
    const clean = String(market).replace(/\(.*?\)|APMC|Mandi|Market|RMC/gi, '').trim();
    for (const q of [`${clean}, ${district}, ${state}`, `${district}, ${state}`]) {
        try {
            await sleep(1100);
            const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q, format: 'json', limit: 1, countrycodes: 'in' },
                headers: { 'User-Agent': 'AgroVolt-AI/1.0 (agrovolt-ai.vercel.app)' },
                timeout: 8000,
            });
            if (data?.[0]) {
                const v = { lat: Number(data[0].lat), lon: Number(data[0].lon), fresh: true };
                await MandiLocation.updateOne({ key }, { lat: v.lat, lon: v.lon }, { upsert: true });
                mem.set(key, { lat: v.lat, lon: v.lon });
                return v;
            }
        } catch { /* try next query */ }
    }
    await MandiLocation.updateOne({ key }, { notFound: true }, { upsert: true }).catch(() => {});
    mem.set(key, null);
    return null;
}

module.exports = { haversineKm, geocodeMandi };
