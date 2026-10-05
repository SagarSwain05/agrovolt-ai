'use strict';
// Rule-based Sahayak: keyword intent detection (English, Hindi, Odia and
// romanised Hindi/Odia) answered from the live farm context. Used when no LLM
// is configured or the LLM call fails.
const i18n = require('./i18n');
const cropRecommender = require('../mlModels/cropRecommender');

const INTENTS = [
    ['greet', /\b(hi|hello|namaste|namaskar|hey)\b|नमस्ते|नमस्कार|ନମସ୍କାର|ନମସ୍ତେ/i],
    ['forecast', /forecast|next (few )?days|week|tomorrow|kal\b|aagami|agami|कल|आने वाले|हफ्ते|पूर्वानुमान|କାଲି|ଆଗାମୀ|ପୂର୍ବାନୁମାନ|ସପ୍ତାହ/i],
    ['weather', /weather|temperature|rain|hot|humid|mausam|barish|baris|garmi|panipag|paani pag|मौसम|बारिश|तापमान|गर्मी|ପାଣିପାଗ|ବର୍ଷା|ତାପମାତ୍ରା|ଗରମ/i],
    ['soil', /soil|moisture|irrigat|water(ing)?\b|sinchai|nami|mitti|jalsechan|pani de|सिंचाई|नमी|मिट्टी|पानी|ଜଳସେଚନ|ଆର୍ଦ୍ରତା|ମାଟି|ପାଣି/i],
    ['solar', /solar|panel|energy|power|electric|kwh|tilt|bijli|surya|saura|सोलर|पैनल|बिजली|ऊर्जा|झुकाव|ସୋଲାର|ପ୍ୟାନେଲ|ବିଦ୍ୟୁତ|ଶକ୍ତି|କୋଣ/i],
    ['market', /price|mandi|market|sell|rate|bhav|bechna|dar\b|bikri|भाव|मंडी|बाज़ार|बाजार|बेच|कीमत|ମଣ୍ଡି|ଦର|ବିକ୍ରି|ବଜାର/i],
    ['carbon', /carbon|credit|co2|emission|कार्बन|क्रेडिट| କାର୍ବନ|କ୍ରେଡିଟ/i],
    ['income', /income|profit|earn|money|revenue|kamai|aay|labh|आय|कमाई|मुनाफा|लाभ|ଆୟ|ଲାଭ|ରୋଜଗାର/i],
    ['disease', /disease|pest|leaf|blight|fung|insect|rog|keet|bimari|रोग|कीट|बीमारी|पत्ती|ରୋଗ|ପୋକ|ପତ୍ର/i],
    ['subsidy', /subsid|kusum|scheme|yojana|loan|सब्सिडी|कुसुम|योजना|ସବସିଡି|କୁସୁମ|ଯୋଜନା/i],
    ['crop', /which crop|what (should i )?(grow|plant)|crop|recommend|fasal|phasal|ugaa|फसल|बोएं|उगाएं|ଫସଲ|ଚାଷ/i],
    ['advice', /what (should|to) do|advice|task|today|suggest|kya karu|kya karun|kana karibi|सलाह|क्या करूं|आज|ପରାମର୍ଶ|କଣ କରିବି|ଆଜି/i],
];

function detectIntent(text) {
    for (const [name, re] of INTENTS) if (re.test(text)) return name;
    return 'unknown';
}

const n = (v, d = 0) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d }));

function answer(text, lang, ctx, renderActions) {
    const t = (k, p) => i18n.t(lang, k, p);
    const intent = detectIntent(text || '');
    const W = ctx.weather || {};
    const f0 = ctx.forecast?.[0] || {};

    switch (intent) {
        case 'greet':
            return { intent, reply: t('a_greet', { name: ctx.user?.name?.split(' ')[0] || '' }) };
        case 'weather':
            return {
                intent,
                reply: t('a_weather', {
                    place: W.location || ctx.farm.district || '', temp: W.temperature, desc: i18n.w(lang, W.description),
                    hum: W.humidity, min: f0.tempMin, max: f0.tempMax, rainChance: f0.rainChance ?? 0, rad: f0.radiationKwhM2,
                }),
            };
        case 'forecast': {
            const list = (ctx.forecast || []).slice(1, 4)
                .map((f) => `${f.day} ${f.tempMin}–${f.tempMax}°C, ${i18n.w(lang, f.description)}${f.rain >= 1 ? ` (${Math.round(f.rain)} mm)` : ''}`)
                .join('; ');
            return { intent, reply: t('a_forecast', { list }) };
        }
        case 'soil': {
            const sm = ctx.sensors?.soilMoisturePct;
            return {
                intent,
                reply: t('a_soil', { sm: n(sm), st: n(ctx.sensors?.soilTempC), hint: t(sm != null && sm < 25 ? 'a_soil_dry' : 'a_soil_ok') }),
            };
        }
        case 'solar':
            if (!ctx.solar) return { intent, reply: t('a_solar_none') };
            return {
                intent,
                reply: t('a_solar', {
                    cap: ctx.solar.capacityKW, power: n(ctx.solar.powerW), today: n(ctx.solar.todayKwh, 1),
                    pt: n(ctx.solar.panelTempC, 1), cool: n(ctx.solar.bioCoolingDeltaC, 1), tilt: ctx.solar.tilt, opt: ctx.solar.optimalTilt,
                }),
            };
        case 'market': {
            const m = ctx.market;
            const advice = m.signal === 'SELL' ? t('a_market_sell') : m.signal === 'WAIT'
                ? t('a_market_wait', { pct: Math.abs(m.pctChange), days: m.waitDays || 7 }) : t('a_market_hold');
            return { intent, reply: t('a_market', { crop: i18n.w(lang, m.crop), price: n(m.bestNet || m.currentPrice), mandi: m.bestMandi, advice }) };
        }
        case 'carbon':
            return {
                intent,
                reply: t('a_carbon', { credits: n(ctx.carbon.credits, 3), co2: n(ctx.carbon.co2AvoidedKg), value: n(ctx.carbon.valueInr), water: n(ctx.carbon.waterSavedL) }),
            };
        case 'income': {
            if (!ctx.solar) return { intent, reply: t('a_solar_none') };
            const solar = ctx.solar.last30.revenue;
            return {
                intent,
                reply: t('a_income', { solar: n(solar), kwh: n(ctx.solar.last30.energyKwh), carbon: n(ctx.carbon.valueInr), total: n(solar + ctx.carbon.valueInr) }),
            };
        }
        case 'disease': {
            const s = ctx.scans?.[0];
            if (!s) return { intent, reply: t('a_disease_none') };
            return {
                intent,
                reply: t('a_disease', { disease: s.disease, crop: i18n.w(lang, s.crop), conf: s.confidence, date: new Date(s.date).toISOString().slice(0, 10) }),
            };
        }
        case 'subsidy':
            return { intent, reply: t('a_subsidy') };
        case 'crop': {
            let list = '';
            try {
                const r = cropRecommender.recommend({
                    soilType: ctx.farm.soilType || 'loamy', rainfall: ctx.farm.annualRainfall || 1450, season: currentSeason(),
                    district: ctx.farm.district, shadowCoverage: ctx.farm.shadeCoveragePct, shadeFactor: (ctx.farm.shadeCoveragePct || 0) / 100,
                    temperature: ctx.weather?.temperature, humidity: ctx.weather?.humidity,
                });
                list = (r.recommendations || []).slice(0, 3)
                    .map((c) => `${i18n.w(lang, c.name || c.crop)} (${Math.round(c.confidence * 100)}%)`).join(', ');
            } catch { /* recommender shape changed */ }
            if (!list) list = ['Turmeric', 'Ginger', 'Spinach'].map((c) => i18n.w(lang, c)).join(', ');
            return { intent, reply: t('a_crop', { soil: i18n.w(lang, ctx.farm.soilType), shade: ctx.farm.shadeCoveragePct, list }) };
        }
        case 'advice': {
            const acts = renderActions(ctx.actions, lang).slice(0, 3).map((a, i) => `${i + 1}. ${a.text}`).join(' ');
            return { intent, reply: t('a_advice', { list: acts }) };
        }
        default:
            return { intent, reply: t('a_unknown') };
    }
}

function currentSeason() {
    const m = new Date().getMonth() + 1;
    if (m >= 6 && m <= 10) return 'kharif';
    if (m >= 11 || m <= 2) return 'rabi';
    return 'zaid';
}

module.exports = { answer, detectIntent, currentSeason };
