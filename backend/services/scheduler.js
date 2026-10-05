'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — background jobs (in-process; the keep-alive ping keeps the
// Render instance awake so these keep running)
//  • hourly: disease-risk, weather and nearby-outbreak alerts per farm
//  • every 30 min: Agmarknet live-feed retry (accumulates real prices)
//  • every 6 h: energy ledger refresh for all solar farms
// ═══════════════════════════════════════════════════════════════════════════
const Farm = require('../models/Farm');
const User = require('../models/User');
const Crop = require('../models/Crop');
const DiseaseScan = require('../models/DiseaseScan');
const Telemetry = require('../models/Telemetry');
const i18n = require('./i18n');
const notify = require('./notify');
const diseaseRisk = require('./diseaseRisk');
const weather = require('./weatherService');

const state = { started: false, lastAlertsRun: null, lastMarketRun: null, lastLedgerRun: null, market: { ok: 0, failed: 0, lastError: null, lastSuccess: null }, alertsSent: 0 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

function riskMessage(r, lang) {
    const t = (k, p) => i18n.t(lang, k, p);
    const disease = t('dz_' + r.id);
    const crops = (r.crops.length ? r.crops : ['crop']).map((c) => i18n.w(lang, c.charAt(0).toUpperCase() + c.slice(1))).join(', ');
    const title = t('risk_title', { level: t('level_' + r.level), disease });
    const body = r.id === 'rhizome_rot'
        ? t('risk_body_rain', { mm: r.rainMm, crops, disease, action: t('act_' + r.id) })
        : t('risk_body', { hours: r.hours, basis: r.basis, crops, disease, action: t('act_' + r.id) });
    return { title, body };
}

async function alertsForFarm(farm, user) {
    const lang = i18n.normLang(user.language);
    const [crops, device] = await Promise.all([
        Crop.find({ farmId: farm._id, status: { $ne: 'harvested' } }).lean(),
        Telemetry.findOne({ farmId: farm._id, source: 'device', ts: { $gte: new Date(Date.now() - 3600e3) } }).sort({ ts: -1 }).lean(),
    ]);
    let sent = 0;
    const risk = await diseaseRisk.assess(farm, crops, device);
    for (const r of risk.risks) {
        const { title, body } = riskMessage(r, lang);
        const n = await notify.send(user._id, { type: 'disease_risk', level: r.level, title, body, lang, data: { risk: r, url: '/scan' }, dedupeKey: `${r.id}|${today()}` });
        if (n) { sent++; require('./webhooks').emitForFarm(farm._id, 'risk.alert', { risk: r.id, level: r.level, crops: r.crops, basis: r.basis }); }
    }
    const alerts = await weather.getAlerts(farm.location.latitude, farm.location.longitude);
    for (const a of alerts.filter((x) => x.severity !== 'low').slice(0, 2)) {
        const idx = Math.max(0, Math.round((new Date(a.date) - new Date(today())) / 86400e3));
        const body = a.type === 'heat' ? i18n.t(lang, 'adv_heat', { t: a.value, when: i18n.when(lang, idx) })
            : i18n.t(lang, 'adv_skip_irrigation', { mm: Math.round(a.value), when: i18n.when(lang, idx) });
        const n = await notify.send(user._id, { type: 'weather', level: a.severity === 'high' ? 'high' : 'medium', title: i18n.t(lang, 'weather_title'), body, lang, data: { alert: a, url: '/dashboard' }, dedupeKey: `wx-${a.type}|${a.date}` });
        if (n) sent++;
    }
    // Soiling (≥7 dry days) → partner webhook, once per ISO week
    if (farm.solarInstalled && farm.epcPartnerId) {
        try {
            const om = await weather.getOpenMeteo(farm.location.latitude, farm.location.longitude, 14);
            const idx = om.daily.time.indexOf(om.current.time.slice(0, 10));
            let dry = 0;
            for (let i = idx - 1; i >= 0 && (om.daily.precipitation_sum[i] || 0) < 2; i--) dry++;
            const wk = `${today().slice(0, 7)}-w${Math.ceil(Number(today().slice(8)) / 7)}`;
            if (dry >= 7 && farm.lastSoilingWebhook !== wk) {
                require('./webhooks').emitForFarm(farm._id, 'soiling.alert', { dryDays: dry, capacityKW: farm.solarCapacityKW });
                farm.lastSoilingWebhook = wk;
                await farm.save();
            }
        } catch { /* weather unavailable */ }
    }

    // Outbreak in the same district (≥3 other farms, last 14 days)
    if (farm.location.district) {
        const peers = await Farm.find({ 'location.district': farm.location.district, _id: { $ne: farm._id } }).select('_id').lean();
        if (peers.length >= 3) {
            const agg = await DiseaseScan.aggregate([
                { $match: { farmId: { $in: peers.map((p) => p._id) }, scannedAt: { $gte: new Date(Date.now() - 14 * 86400e3) }, detectedDisease: { $not: /healthy/i } } },
                { $group: { _id: { d: '$detectedDisease', c: '$cropName' }, farms: { $addToSet: '$farmId' } } },
            ]);
            for (const o of agg.filter((x) => x.farms.length >= 3)) {
                const week = today().slice(0, 8) + String(Math.ceil(Number(today().slice(8)) / 7));
                const n = await notify.send(user._id, {
                    type: 'outbreak', level: 'high', lang,
                    title: i18n.t(lang, 'outbreak_title', { disease: o._id.d }),
                    body: i18n.t(lang, 'outbreak_body', { n: o.farms.length, disease: o._id.d, crop: i18n.w(lang, o._id.c) }),
                    data: { url: '/district' }, dedupeKey: `outbreak|${o._id.d}|${week}`,
                });
                if (n) sent++;
            }
        }
    }
    return sent;
}

async function runAlerts() {
    state.lastAlertsRun = new Date();
    const farms = await Farm.find({}).limit(2000);
    for (const farm of farms) {
        try {
            const user = await User.findById(farm.userId).select('language notificationPrefs phone pushSubscriptions');
            if (!user) continue;
            state.alertsSent += await alertsForFarm(farm, user);
        } catch (e) { console.error('[scheduler] alerts', String(farm._id), e.message); }
        await sleep(300);
    }
}

async function runMarket() {
    state.lastMarketRun = new Date();
    const agmarknet = require('./agmarknetLive');
    const states = (await Farm.distinct('location.state')).filter(Boolean);
    for (const st of states.length ? states : ['Odisha']) {
        for (const crop of ['Tomato', 'Turmeric', 'Rice', 'Wheat', 'Millet', 'Groundnut', 'Soybean']) {
            try {
                const r = await agmarknet.getLive(crop, st, { force: true });
                if (r.records.length) { state.market.ok++; state.market.lastSuccess = new Date(); }
            } catch (e) {
                state.market.failed++; state.market.lastError = `${new Date().toISOString()} ${e.code || ''} ${e.message}`.slice(0, 200);
                return; // upstream down — stop this round
            }
            await sleep(1500);
        }
    }
}

async function runLedgers() {
    state.lastLedgerRun = new Date();
    const ledger = require('./energyLedger');
    const farms = await Farm.find({ solarInstalled: true });
    for (const f of farms) { await ledger.ensureLedger(f).catch(() => { }); await sleep(500); }
}

function every(ms, fn, firstDelay) {
    const run = () => fn().catch((e) => console.error('[scheduler]', e.message));
    setTimeout(() => { run(); setInterval(run, ms); }, firstDelay);
}

function start() {
    if (state.started || process.env.DISABLE_SCHEDULER === 'true') return state;
    state.started = true;
    every(60 * 60e3, runAlerts, 2 * 60e3);
    every(30 * 60e3, runMarket, 60e3);
    every(6 * 3600e3, runLedgers, 5 * 60e3);
    console.log('⏱️  Scheduler started (alerts hourly, market 30 min, ledgers 6 h)');
    return state;
}

module.exports = { start, state: () => state, alertsForFarm, riskMessage, runMarket };
