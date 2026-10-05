'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Gemini client
// - Key pool: GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY
// - Model chain, fastest/most available first; a model+key pair that returns
//   503/429 is put on a short cooldown and the next pair is tried.
// - generate(): chat / JSON / audio-in. speak(): text-to-speech (WAV).
// - translate(): cached translation for dynamic content (diagnoses, KB text).
// Returns null when unconfigured or every pair fails, so callers fall back.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');
const crypto = require('crypto');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_CHAT = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];
const DEFAULT_TTS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'];
const COOLDOWN_MS = 90 * 1000;
const cooldown = new Map(); // `${model}|${keyIdx}` → until

function keys() {
    const list = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
        .split(',').map((k) => k.trim()).filter(Boolean);
    return [...new Set(list)];
}
const chatModels = () => (process.env.GEMINI_MODELS ? process.env.GEMINI_MODELS.split(',').map((s) => s.trim()) : [process.env.GEMINI_MODEL, ...DEFAULT_CHAT]).filter(Boolean);
const ttsModels = () => (process.env.GEMINI_TTS_MODELS ? process.env.GEMINI_TTS_MODELS.split(',').map((s) => s.trim()) : DEFAULT_TTS);

function isConfigured() {
    return keys().length > 0;
}

let rr = 0; // round-robin start key, spreads load across the pool
function* pairs(models) {
    const ks = keys();
    const start = rr++ % Math.max(1, ks.length);
    for (const m of [...new Set(models)]) {
        for (let i = 0; i < ks.length; i++) {
            const ki = (start + i) % ks.length;
            const until = cooldown.get(`${m}|${ki}`);
            if (until && until > Date.now()) continue;
            yield { model: m, key: ks[ki], ki };
        }
    }
}

async function post(model, key, body, timeout) {
    const { data } = await axios.post(`${BASE}/${model}:generateContent`, body, {
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        timeout,
    });
    return data;
}

/** Run `body` through the model chain until one succeeds and `accept(data)` returns a value. */
async function runChain(models, body, accept, { timeout = 25000, budgetMs = 45000 } = {}) {
    if (!isConfigured()) return null;
    const t0 = Date.now();
    for (const p of pairs(models)) {
        if (Date.now() - t0 > budgetMs) break;
        try {
            const data = await post(p.model, p.key, body, timeout);
            const v = accept(data);
            if (v != null) return { ...v, model: p.model };
        } catch (e) {
            const status = e.response?.status;
            const msg = e.response?.data?.error?.message || e.message;
            console.error(`[llm] ${p.model} k${p.ki} → ${status || e.code} ${String(msg).slice(0, 120)}`);
            if (status === 503 || status === 429 || status === 500 || e.code === 'ECONNABORTED') {
                cooldown.set(`${p.model}|${p.ki}`, Date.now() + COOLDOWN_MS);
            } else if (status === 404) {
                for (let i = 0; i < keys().length; i++) cooldown.set(`${p.model}|${i}`, Date.now() + 3600 * 1000);
            } else if (status === 401 || status === 403) {
                cooldown.set(`${p.model}|${p.ki}`, Date.now() + 3600 * 1000);
            }
        }
    }
    return null;
}

const textOf = (data) => (data?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();

/**
 * @param {object} p
 * @param {string} p.system
 * @param {Array}  p.history  [{role:'user'|'assistant', text}]
 * @param {string} [p.text]
 * @param {{mimeType:string,data:string}} [p.audio]
 * @param {object} [p.schema] JSON response schema
 */
async function generate({ system, history = [], text, audio, schema, maxTokens = 900, temperature = 0.4 }) {
    const contents = history.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.text || '').slice(0, 2000) }],
    }));
    const parts = [];
    if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data } });
    if (text) parts.push({ text: String(text).slice(0, 6000) });
    contents.push({ role: 'user', parts });
    const body = {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
        },
    };
    return runChain(chatModels(), body, (data) => {
        const out = textOf(data);
        if (!out) return null;
        if (!schema) return { text: out };
        try { return { json: JSON.parse(out) }; } catch {
            const m = out.match(/\{[\s\S]*\}/);
            try { return m ? { json: JSON.parse(m[0]) } : null; } catch { return null; }
        }
    });
}

/** Text → WAV buffer via Gemini TTS. */
async function speak(text, { voice = 'Kore', style } = {}) {
    const prompt = style ? `${style}: ${text}` : text;
    const body = {
        contents: [{ parts: [{ text: prompt.slice(0, 1500) }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    };
    const r = await runChain(ttsModels(), body, (data) => {
        const inline = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData)?.inlineData;
        if (!inline?.data) return null;
        let buf = Buffer.from(inline.data, 'base64');
        // Some models return raw 16-bit PCM ("audio/l16; rate=24000") — wrap it in a WAV header
        if (!/wav/i.test(inline.mimeType)) {
            const rate = Number(/rate=(\d+)/.exec(inline.mimeType)?.[1] || 24000);
            buf = pcmToWav(buf, rate);
        }
        return { audio: buf, mimeType: 'audio/wav' };
    }, { timeout: Number(process.env.GEMINI_TTS_TIMEOUT_MS) || 14000, budgetMs: Number(process.env.GEMINI_TTS_BUDGET_MS) || 18000 });
    return r;
}

function pcmToWav(pcm, rate = 24000, channels = 1, bits = 16) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
    h.writeUInt32LE((rate * channels * bits) / 8, 28); h.writeUInt16LE((channels * bits) / 8, 32); h.writeUInt16LE(bits, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

// ── Translation with an in-memory + Mongo cache ─────────────────────────────
const LANG_NAME = { en: 'English', hi: 'Hindi (Devanagari script)', or: 'Odia (Odia script)' };
const memT = new Map();

/**
 * Translate an object of strings (or arrays of strings) to `lang`, keeping the keys.
 * Agricultural chemical names and doses are preserved.
 */
async function translate(obj, lang) {
    if (!lang || lang === 'en' || !isConfigured()) return null;
    const src = JSON.stringify(obj);
    const key = crypto.createHash('sha1').update(lang + '|' + src).digest('hex');
    if (memT.has(key)) return memT.get(key);
    const Cache = require('../models/TranslationCache');
    const hit = await Cache.findOne({ key }).lean().catch(() => null);
    if (hit) { memT.set(key, hit.value); return hit.value; }
    const r = await generate({
        system: `Translate every string value of the JSON into ${LANG_NAME[lang]} for a farmer audience. Keep the same JSON keys and array lengths. Keep chemical/product names, doses (g/L, ml/L) and numbers exactly. Output JSON only.`,
        text: src,
        maxTokens: 2500,
        temperature: 0.1,
        schema: undefined,
    });
    if (!r?.text) return null;
    let value = null;
    try { value = JSON.parse((r.text.match(/\{[\s\S]*\}|\[[\s\S]*\]/) || [r.text])[0]); } catch { return null; }
    memT.set(key, value);
    Cache.create({ key, lang, value }).catch(() => { });
    return value;
}

module.exports = { generate, speak, translate, isConfigured, keys, pcmToWav };
