'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Live Agmarknet mandi prices (data.gov.in OGD API)
// Resource: "Current daily price of various commodities from various markets"
// Each successful fetch is persisted to MarketData, so price history for the
// forecaster accumulates from real arrivals over time.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');
const MarketData = require('../models/MarketData');

const RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070';
const TTL_MS = 6 * 3600 * 1000;
const cache = new Map();

// App crop name → Agmarknet commodity names (first match wins)
const COMMODITY = {
    Tomato: ['Tomato'],
    Turmeric: ['Turmeric', 'Turmeric (raw)'],
    Rice: ['Paddy(Dhan)(Common)', 'Rice', 'Paddy(Dhan)(Basmati)'],
    Wheat: ['Wheat'],
    Millet: ['Ragi (Finger Millet)', 'Bajra(Pearl Millet/Cumbu)', 'Jowar(Sorghum)'],
    Groundnut: ['Groundnut', 'Groundnut pods (raw)'],
    Soybean: ['Soyabean'],
    Ginger: ['Ginger(Green)', 'Ginger(Dry)'],
    Potato: ['Potato'],
    Onion: ['Onion'],
    Chili: ['Green Chilli', 'Dry Chillies'],
    Brinjal: ['Brinjal'],
    Cabbage: ['Cabbage'],
    Cauliflower: ['Cauliflower'],
    Spinach: ['Spinach'],
};

function parseDate(s) {
    // "05/10/2026" (dd/mm/yyyy)
    const [d, m, y] = String(s || '').split('/').map(Number);
    return y ? new Date(Date.UTC(y, m - 1, d)) : new Date();
}

async function fetchCommodity(commodity, state) {
    const key = process.env.AGMARKNET_API_KEY;
    if (!key) throw new Error('AGMARKNET_API_KEY not configured');
    const params = { 'api-key': key, format: 'json', limit: 200, 'filters[commodity]': commodity };
    if (state) params['filters[state.keyword]'] = state;
    const { data } = await axios.get(`https://api.data.gov.in/resource/${RESOURCE}`, { params, timeout: 15000 });
    return Array.isArray(data?.records) ? data.records : [];
}

/**
 * Live records for a crop. Tries the farm's state first, then all-India.
 * Returns { records, scope, commodity, fetchedAt } or throws.
 */
const status = { lastSuccess: null, lastError: null, lastAttempt: null };

async function getLive(crop, state, { force = false } = {}) {
    const k = `${crop}|${state || ''}`;
    const hit = cache.get(k);
    if (!force && hit && Date.now() - hit.t < TTL_MS) return hit.v;
    // While the upstream is known to be down, don't hammer it on every page view
    if (!force && status.lastError && Date.now() - new Date(status.lastError.at).getTime() < 10 * 60e3 && !(status.lastSuccess > status.lastError.at)) {
        throw new Error('data.gov.in unavailable (cached failure)');
    }
    status.lastAttempt = new Date();

    const names = COMMODITY[crop] || [crop];
    let result = null;
    for (const scope of [state, null]) {
        for (const commodity of names) {
            let records;
            try { records = await fetchCommodity(commodity, scope); }
            catch (e) { status.lastError = { at: new Date(), message: `${e.code || e.response?.status || ''} ${e.message}`.trim() }; throw e; }
            status.lastSuccess = new Date();
            if (records.length) {
                result = { records, scope: scope || 'India', commodity, fetchedAt: new Date().toISOString() };
                break;
            }
        }
        if (result) break;
    }
    if (!result) result = { records: [], scope: state || 'India', commodity: names[0], fetchedAt: new Date().toISOString() };
    cache.set(k, { t: Date.now(), v: result });
    persist(crop, result.records).catch((e) => console.error('[agmarknet] persist:', e.message));
    return result;
}

async function persist(crop, records) {
    if (!records.length) return;
    const ops = records.map((r) => {
        const date = parseDate(r.arrival_date);
        return {
            updateOne: {
                filter: { cropName: crop, mandiName: r.market, date },
                update: {
                    $set: {
                        district: r.district, state: r.state,
                        price: Number(r.modal_price), minPrice: Number(r.min_price), maxPrice: Number(r.max_price),
                    },
                },
                upsert: true,
            },
        };
    });
    await MarketData.bulkWrite(ops, { ordered: false });
}

/** Daily modal-price history (median across mandis) accumulated from live fetches. */
async function getHistory(crop, state, days = 90) {
    const since = new Date(Date.now() - days * 86400000);
    const match = { cropName: crop, date: { $gte: since } };
    if (state) match.state = state;
    const rows = await MarketData.aggregate([
        { $match: match },
        { $group: { _id: '$date', prices: { $push: '$price' } } },
        { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => {
        const p = r.prices.filter(Number.isFinite).sort((a, b) => a - b);
        return { date: r._id.toISOString().slice(0, 10), price: p[Math.floor(p.length / 2)] };
    });
}

module.exports = { getLive, getHistory, COMMODITY, status: () => status };
