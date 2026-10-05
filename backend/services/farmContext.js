'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Farm context
// One snapshot of everything live about a farm (weather, sensors, solar
// ledger, market, carbon, crops, scans) plus prioritised advisory actions.
// Consumed by the dashboard and by the Sahayak assistant.
// ═══════════════════════════════════════════════════════════════════════════
const Farm = require('../models/Farm');
const Crop = require('../models/Crop');
const SolarData = require('../models/SolarData');
const CarbonTransaction = require('../models/CarbonTransaction');
const DiseaseScan = require('../models/DiseaseScan');
const weather = require('./weatherService');
const ledger = require('./energyLedger');
const physics = require('./agrivoltaicPhysics');
const solarPosition = require('../mlModels/solarPosition');
const priceForecaster = require('../mlModels/priceForecaster');
const agmarknet = require('./agmarknetLive');
const i18n = require('./i18n');

const MARKET_CROPS = ['Tomato', 'Turmeric', 'Rice', 'Wheat', 'Millet', 'Groundnut', 'Soybean'];

const settle = (p) => p.then((v) => v, (e) => { console.error('[context]', e.message); return null; });

function pickMarketCrop(farm, crops) {
    const names = [...crops.map((c) => c.cropName), farm.cropUnderPanels].filter(Boolean);
    for (const n of names) {
        const m = MARKET_CROPS.find((c) => c.toLowerCase() === String(n).toLowerCase());
        if (m) return m;
    }
    return 'Tomato';
}

async function buildContext(user) {
    const farm = await Farm.findOne({ userId: user._id });
    if (!farm) return null;
    const { latitude: lat, longitude: lon } = farm.location;

    await settle(ledger.ensureLedger(farm));

    const since30 = new Date(Date.now() - 30 * 86400000);
    const [current, forecast, past, crops, solarRows, carbonTx, scans] = await Promise.all([
        settle(weather.getCurrent(lat, lon)),
        settle(weather.getForecast(lat, lon)),
        settle(weather.getOpenMeteo(lat, lon, 14)),
        Crop.find({ farmId: farm._id, status: { $ne: 'harvested' } }).lean(),
        SolarData.find({ farmId: farm._id, date: { $gte: since30 } }).sort({ date: 1 }).lean(),
        CarbonTransaction.find({ farmId: farm._id }).lean(),
        DiseaseScan.find({ farmId: farm._id }).sort({ scannedAt: -1 }).limit(5).lean(),
    ]);

    // Live sensor snapshot (physical device if fresh, else virtual node)
    const { latestReading } = require('../controllers/iotController');
    const sensors = await settle(latestReading(farm));

    // Solar
    const hasSolar = farm.solarInstalled && farm.solarCapacityKW > 0;
    const optimalTilt = solarPosition.getOptimalTilt(lat, lon);
    const today = solarRows.find((r) => r.isPartial) || null;
    const energy30 = solarRows.reduce((s, r) => s + (r.energyProduced || 0), 0);
    const revenue30 = solarRows.reduce((s, r) => s + (r.revenue || 0), 0);
    const water30 = solarRows.reduce((s, r) => s + (r.waterSavedLiters || 0), 0);
    const coolGain30 = solarRows.reduce((s, r) => s + (r.bioCoolingGainKwh || 0), 0);

    // Carbon
    const earned = carbonTx.filter((t) => t.transactionType === 'earned');
    const withdrawn = carbonTx.filter((t) => t.transactionType === 'withdrawn');
    const credits = earned.reduce((s, t) => s + t.creditsEarned, 0) - withdrawn.reduce((s, t) => s + t.creditsEarned, 0);
    const co2 = earned.reduce((s, t) => s + (t.co2ReducedKg || 0), 0);
    const waterAll = earned.reduce((s, t) => s + (t.waterSavedLiters || 0), 0);

    // Market (live history if accumulated, else snapshot)
    const marketCrop = pickMarketCrop(farm, crops);
    const hist = await settle(agmarknet.getHistory(marketCrop, farm.location.state));
    const fc = priceForecaster.forecast(marketCrop, 14, { daily: hist || [] });
    const mandis = priceForecaster.getMandiPrices(marketCrop, farm.location.district || 'Khordha');

    // Rain-free streak (for soiling) from the last 14 days of observed precipitation
    let dryDays = 0;
    if (past?.daily) {
        const todayStr = past.current.time.slice(0, 10);
        const idxToday = past.daily.time.indexOf(todayStr);
        for (let i = idxToday - 1; i >= 0; i--) {
            if ((past.daily.precipitation_sum[i] || 0) >= 2) break;
            dryDays++;
        }
    }

    const ctx = {
        user: { name: user.name, language: user.language },
        farm: {
            name: farm.farmName, sizeAcres: farm.farmSize, soilType: farm.soilType,
            district: farm.location.district, state: farm.location.state, lat, lon,
            cropUnderPanels: farm.cropUnderPanels, shadeCoveragePct: farm.shadeCoverage,
        },
        weather: current,
        forecast: forecast?.forecast || [],
        sensors,
        solar: hasSolar ? {
            capacityKW: farm.solarCapacityKW, panelCount: farm.panelCount, tilt: farm.panelTilt, optimalTilt,
            tiltGainPct: Math.round((1 / physics.tiltFactor(farm.panelTilt, optimalTilt) - 1) * 1000) / 10,
            tariffPerKwh: farm.tariffPerKwh,
            todayKwh: sensors?.energyTodayKwh ?? today?.energyProduced ?? 0,
            powerW: sensors?.powerW ?? 0,
            panelTempC: sensors?.panelTempC, bioCoolingDeltaC: sensors?.bioCoolingDeltaC,
            last30: { energyKwh: Math.round(energy30 * 10) / 10, revenue: Math.round(revenue30), waterSavedL: Math.round(water30), bioCoolingGainKwh: Math.round(coolGain30 * 10) / 10 },
            daily: solarRows.map((r) => ({ day: r.day || r.date.toISOString().slice(0, 10), kwh: r.energyProduced, revenue: r.revenue, irradiance: r.irradianceKwhM2, partial: r.isPartial })),
            dryDays,
        } : null,
        carbon: {
            credits: Math.max(0, Math.round(credits * 1000) / 1000),
            co2AvoidedKg: Math.round(co2),
            valueInr: Math.round(Math.max(0, credits) * physics.CREDIT_PRICE_INR),
            waterSavedL: Math.round(waterAll),
            pricePerCredit: physics.CREDIT_PRICE_INR,
        },
        crops: crops.map((c) => ({ name: c.cropName, season: c.season, status: c.status, health: c.healthScore, harvest: c.expectedHarvestDate })),
        scans: scans.map((s) => ({ crop: s.cropName, disease: s.detectedDisease, confidence: s.confidenceScore, severity: s.severity, status: s.status, date: s.scannedAt })),
        market: {
            crop: marketCrop,
            currentPrice: fc.currentPrice, signal: fc.signal, pctChange: fc.pctChange, waitDays: fc.waitDays,
            bestMandi: mandis[0]?.mandi, bestNet: mandis[0]?.netProfit, source: fc.dataSource, asOf: fc.asOf,
        },
    };
    // Microclimate disease risk (feeds actions, Sahayak and the dashboard)
    const risk = await settle(require('./diseaseRisk').assess(farm, crops, sensors?.source === 'device' ? sensors : null));
    ctx.diseaseRisk = risk ? { risks: risk.risks.map(({ id, level, hours, crops: c, basis, rainMm }) => ({ id, level, hours, crops: c, basis, rainMm })), source: risk.source } : null;
    ctx.hardware = { verified: !!farm.isHardwareVerified, since: farm.hardwareVerifiedAt || null, calibration: farm.calibration || null };
    ctx.actions = buildActions(ctx);
    return ctx;
}

/** Prioritised, language-neutral action codes (rendered per language by renderActions). */
function buildActions(ctx) {
    const a = [];
    const f0 = ctx.forecast[0], f1 = ctx.forecast[1];
    const sm = ctx.sensors?.soilMoisturePct;
    const tmax = f0?.tempMax;

    const rainIdx = ctx.forecast.slice(0, 2).findIndex((f) => (f.rain || 0) >= 10);
    if (rainIdx >= 0) {
        a.push({ code: 'adv_skip_irrigation', type: 'water', priority: 2, params: { mm: Math.round(ctx.forecast[rainIdx].rain), whenIdx: rainIdx } });
    } else if (tmax >= 34 && sm != null && sm < 35) {
        const d = ctx.solar ? Math.max(1, Math.round((ctx.sensors?.bioCoolingDeltaC || 1.5) * 1.6 * 10) / 10) : 2;
        a.push({ code: 'adv_irrigate_cool', type: 'water', priority: 1, params: { sm: Math.round(sm), t: tmax, d } });
    } else if (sm != null && sm < 18) {
        a.push({ code: 'adv_irrigate_dry', type: 'water', priority: 2, params: { sm: Math.round(sm) } });
    }
    const hot = ctx.forecast.slice(0, 3).findIndex((f) => f.tempMax >= 38);
    if (hot >= 0) a.push({ code: 'adv_heat', type: 'alert', priority: 1, params: { t: ctx.forecast[hot].tempMax, whenIdx: hot } });

    if (ctx.solar) {
        if (Math.abs((ctx.solar.tilt ?? ctx.solar.optimalTilt) - ctx.solar.optimalTilt) >= 5 && ctx.solar.tiltGainPct >= 1) {
            a.push({ code: 'adv_tilt', type: 'solar', priority: 2, params: { cur: ctx.solar.tilt, opt: ctx.solar.optimalTilt, gain: ctx.solar.tiltGainPct } });
        }
        if (ctx.solar.dryDays >= 7) a.push({ code: 'adv_clean', type: 'solar', priority: 3, params: { n: ctx.solar.dryDays } });
        if (f1 && f1.radiationKwhM2 < 3) a.push({ code: 'adv_low_sun', type: 'solar', priority: 4, params: { rad: f1.radiationKwhM2, whenIdx: 1 } });
    } else {
        a.push({ code: 'adv_setup_solar', type: 'setup', priority: 3, params: {} });
    }

    const sick = ctx.scans.find((s) => s.status === 'pending' && s.disease && !/healthy/i.test(s.disease) && ['medium', 'high', 'critical'].includes(s.severity));
    if (sick) a.push({ code: 'adv_disease', type: 'crop', priority: 2, params: { disease: sick.disease, crop: sick.crop, date: new Date(sick.date).toISOString().slice(0, 10) } });

    for (const r of (ctx.diseaseRisk?.risks || []).slice(0, 2)) {
        a.push({ code: 'risk', type: 'alert', priority: r.level === 'high' ? 0 : 2, params: { risk: r } });
    }

    const m = ctx.market;
    if (m.currentPrice) {
        const code = m.signal === 'SELL' ? 'adv_sell' : m.signal === 'WAIT' ? 'adv_wait' : 'adv_hold';
        a.push({ code, type: 'market', priority: m.signal === 'HOLD' ? 5 : 3, params: { crop: m.crop, price: m.bestNet || m.currentPrice, mandi: m.bestMandi, pct: Math.abs(m.pctChange), days: m.waitDays || 7 } });
    }
    a.sort((x, y) => x.priority - y.priority);
    return a;
}

function renderActions(actions, lang) {
    if (!actions.length) return [{ code: 'adv_all_good', type: 'info', priority: 9, text: i18n.t(lang, 'adv_all_good') }];
    const { riskMessage } = require('./scheduler');
    return actions.map((x) => {
        if (x.code === 'risk') {
            const msg = riskMessage(x.params.risk, lang);
            return { ...x, text: `${msg.title}. ${msg.body}` };
        }
        const p = { ...x.params };
        if (p.whenIdx != null) p.when = i18n.when(lang, p.whenIdx);
        if (p.crop) p.crop = i18n.w(lang, p.crop);
        return { ...x, text: i18n.t(lang, x.code, p) };
    });
}

module.exports = { buildContext, renderActions };
