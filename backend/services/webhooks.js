'use strict';
// Partner webhooks — HMAC-SHA256 signed (header X-AgroVolt-Signature: sha256=<hex>).
const crypto = require('crypto');
const axios = require('axios');
const PartnerKey = require('../models/PartnerKey');
const Farm = require('../models/Farm');

async function deliver(pk, event, payload) {
    const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data: payload });
    const sig = crypto.createHmac('sha256', pk.webhookSecret || '').update(body).digest('hex');
    try {
        await axios.post(pk.webhookUrl, body, { headers: { 'Content-Type': 'application/json', 'X-AgroVolt-Event': event, 'X-AgroVolt-Signature': `sha256=${sig}` }, timeout: 8000 });
        return true;
    } catch (e) {
        console.error(`[webhook] ${pk.webhookUrl} ${event}: ${e.response?.status || e.message}`);
        return false;
    }
}

/** Fire `event` to every webhook of the partner linked to `farmId`. */
async function emitForFarm(farmId, event, payload) {
    try {
        const farm = await Farm.findById(farmId).select('epcPartnerId location.district').lean();
        if (!farm?.epcPartnerId) return;
        const keys = await PartnerKey.find({ ownerId: farm.epcPartnerId, isActive: true, webhookUrl: { $exists: true, $ne: '' }, webhookEvents: event });
        await Promise.all(keys.map((k) => deliver(k, event, { farmCode: `AV-${String(farmId).slice(-6).toUpperCase()}`, district: farm.location?.district, ...payload })));
    } catch (e) { console.error('[webhook] emit:', e.message); }
}

module.exports = { emitForFarm, deliver };
