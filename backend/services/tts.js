'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Text-to-speech provider chain (server side)
//
//   Odia (or): Bhashini (Govt. of India, if BHASHINI_* set) → Gemini TTS →
//              Hindi neural voice reading an Odia→Devanagari transliteration
//   Hindi/English: Edge neural voices (free) → Gemini TTS
//
// The browser additionally ships Meta MMS-TTS Odia for offline use.
// TTS_ODIA_PROVIDERS / TTS_DEFAULT_PROVIDERS override the order.
// Every result is cached (memory + MongoDB, 30 days).
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const axios = require('axios');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const llm = require('./llm');

const EDGE_VOICES = { en: 'en-IN-NeerjaNeural', hi: 'hi-IN-SwaraNeural', or: 'hi-IN-SwaraNeural' };
const mem = new Map();
const MEM_MAX = 80;

const ODIA_SPECIAL = { 0x0b2f: 0x091c, 0x0b5f: 0x092f, 0x0b71: 0x0935, 0x0b35: 0x0935, 0x0b56: null, 0x0b57: null };

function odiaToDevanagari(text) {
    let out = '';
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x0b00 && cp <= 0x0b7f) {
            if (cp in ODIA_SPECIAL) { if (ODIA_SPECIAL[cp] != null) out += String.fromCodePoint(ODIA_SPECIAL[cp]); }
            else out += String.fromCodePoint(cp - 0x200);
        } else out += ch;
    }
    return out;
}

function clean(text) {
    return String(text || '').replace(/[*_#`>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

// ── Providers ──────────────────────────────────────────────────────────────
async function edge(text, lang) {
    let input = text.replace(/₹\s?/g, lang === 'en' ? 'Rs ' : 'रुपये ');
    if (lang === 'or') input = odiaToDevanagari(input);
    const tts = new MsEdgeTTS();
    try {
        await tts.setMetadata(EDGE_VOICES[lang], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(input);
        const chunks = [];
        await new Promise((resolve, reject) => {
            audioStream.on('data', (c) => chunks.push(c));
            audioStream.on('end', resolve);
            audioStream.on('close', resolve);
            audioStream.on('error', reject);
            setTimeout(() => reject(new Error('Edge TTS timeout')), 20000);
        });
        const audio = Buffer.concat(chunks);
        if (!audio.length) throw new Error('Edge TTS returned no audio');
        return { audio, mimeType: 'audio/mpeg', voice: EDGE_VOICES[lang], provider: lang === 'or' ? 'edge-transliterated' : 'edge' };
    } finally {
        try { tts.close(); } catch { /* closed */ }
    }
}

async function gemini(text, lang) {
    if (!llm.isConfigured()) throw new Error('Gemini not configured');
    const style = { or: 'Say clearly in Odia, warm and slow, for a farmer', hi: 'Say clearly in Hindi, warm and slow, for a farmer', en: 'Say clearly in Indian English, warm and slow' }[lang];
    const t0 = Date.now();
    const r = await llm.speak(text, { voice: process.env.GEMINI_TTS_VOICE || 'Kore', style });
    if (!r) throw new Error('Gemini TTS unavailable');
    const t1 = Date.now();
    let audio = r.audio, mimeType = r.mimeType;
    try {
        const mp3 = await require('./mp3').wavToMp3(r.audio);
        console.log(`[tts] gemini ${r.model} synth ${t1 - t0}ms, mp3 ${Date.now() - t1}ms, ${r.audio.length}→${mp3?.length}B`);
        if (mp3?.length) { audio = mp3; mimeType = 'audio/mpeg'; }
    } catch (e) { console.error('[tts] mp3 encode:', e.message); }
    return { audio, mimeType, voice: `${r.model}/Kore`, provider: 'gemini' };
}

// Bhashini (ULCA) pipeline: discover the TTS service, then run inference.
let bhashiniCfg = null;
async function bhashini(text, lang) {
    const userID = process.env.BHASHINI_USER_ID, apiKey = process.env.BHASHINI_API_KEY;
    if (!userID || !apiKey) throw new Error('Bhashini not configured');
    if (!bhashiniCfg || bhashiniCfg.lang !== lang || Date.now() - bhashiniCfg.t > 6 * 3600e3) {
        const { data } = await axios.post('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
            pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: lang } } }],
            pipelineRequestConfig: { pipelineId: process.env.BHASHINI_PIPELINE_ID || '64392f96daac500b55c543cd' },
        }, { headers: { userID, ulcaApiKey: apiKey }, timeout: 15000 });
        const ep = data.pipelineInferenceAPIEndPoint;
        const svc = data.pipelineResponseConfig?.[0]?.config?.[0];
        bhashiniCfg = { lang, t: Date.now(), url: ep.callbackUrl, auth: { [ep.inferenceApiKey.name]: ep.inferenceApiKey.value }, serviceId: svc?.serviceId };
    }
    const { data } = await axios.post(bhashiniCfg.url, {
        pipelineTasks: [{ taskType: 'tts', config: { language: { sourceLanguage: lang }, serviceId: bhashiniCfg.serviceId, gender: 'female', samplingRate: 22050 } }],
        inputData: { input: [{ source: text }] },
    }, { headers: { ...bhashiniCfg.auth, 'Content-Type': 'application/json' }, timeout: 30000 });
    const b64 = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
    if (!b64) throw new Error('Bhashini returned no audio');
    return { audio: Buffer.from(b64, 'base64'), mimeType: 'audio/wav', voice: `bhashini/${bhashiniCfg.serviceId}`, provider: 'bhashini' };
}

const PROVIDERS = { edge, gemini, bhashini };

function chainFor(lang) {
    const env = lang === 'or' ? process.env.TTS_ODIA_PROVIDERS : process.env.TTS_DEFAULT_PROVIDERS;
    if (env) return env.split(',').map((s) => s.trim()).filter((p) => PROVIDERS[p]);
    return lang === 'or' ? ['bhashini', 'gemini', 'edge'] : ['edge', 'gemini'];
}

/**
 * @returns {Promise<{audio:Buffer,mimeType:string,voice:string,provider:string}>}
 */
const inflight = new Map();

async function synthesize(text, lang = 'en', opts = {}) {
    const k = `${lang}|${opts.prefer || ''}|${clean(text)}`;
    if (inflight.has(k)) return inflight.get(k);
    const p = synthesizeOnce(text, lang, opts).finally(() => inflight.delete(k));
    inflight.set(k, p);
    return p;
}

/** Split a reply into speakable sentences (the client requests them one by one). */
function sentences(text) {
    return clean(text).split(/(?<=[।.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

/** Start synthesis in the background (sentence by sentence, first ones first) so the client's /tts requests hit cache or in-flight work. */
async function prewarm(text, lang) {
    const parts = sentences(text);
    for (let i = 0; i < parts.length; i += 2) {
        await Promise.all(parts.slice(i, i + 2).map((p) => synthesize(p, lang).catch(() => { })));
    }
}

async function synthesizeOnce(text, lang = 'en', { prefer } = {}) {
    const l = EDGE_VOICES[lang] ? lang : 'en';
    const input = clean(text);
    if (!input) throw new Error('Empty text');
    let chain = chainFor(l);
    if (prefer && PROVIDERS[prefer]) chain = [prefer, ...chain.filter((p) => p !== prefer)];

    const key = crypto.createHash('sha1').update(`${l}|${chain.join('>')}|${input}`).digest('hex');
    if (mem.has(key)) return mem.get(key);
    const AudioCache = require('../models/AudioCache');
    const hit = await AudioCache.findOne({ key }).lean().catch(() => null);
    if (hit) {
        const v = { audio: Buffer.from(hit.data.buffer || hit.data), mimeType: hit.mimeType, voice: hit.provider, provider: hit.provider, cached: true };
        remember(key, v);
        return v;
    }

    const errors = [];
    for (const name of chain) {
        try {
            const v = await PROVIDERS[name](input, l);
            remember(key, v);
            AudioCache.create({ key, provider: v.provider, mimeType: v.mimeType, data: v.audio }).catch(() => { });
            return v;
        } catch (e) {
            errors.push(`${name}: ${e.message}`);
        }
    }
    throw new Error('All TTS providers failed — ' + errors.join('; '));
}

function remember(k, v) {
    mem.set(k, v);
    if (mem.size > MEM_MAX) mem.delete(mem.keys().next().value);
}

module.exports = { synthesize, prewarm, sentences, odiaToDevanagari, chainFor };
