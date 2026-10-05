'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — LLM client (Google Gemini, free tier)
// REST only, no SDK. Supports text and audio (speech-to-text + answer in one
// call). Returns null when unconfigured or failing so callers can fall back
// to the rule-based assistant.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');

const MODELS = () => [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest'].filter(Boolean);
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function isConfigured() {
    return !!process.env.GEMINI_API_KEY;
}

/**
 * @param {object} p
 * @param {string} p.system           system instruction
 * @param {Array}  p.history          [{role:'user'|'assistant', text}]
 * @param {string} [p.text]           current user message
 * @param {{mimeType:string,data:string}} [p.audio]  base64 audio for the current turn
 * @param {object} [p.schema]         JSON response schema (forces JSON output)
 */
async function generate({ system, history = [], text, audio, schema, maxTokens = 700, temperature = 0.4 }) {
    if (!isConfigured()) return null;
    const contents = history.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.text || '').slice(0, 2000) }],
    }));
    const parts = [];
    if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data } });
    if (text) parts.push({ text: String(text).slice(0, 4000) });
    contents.push({ role: 'user', parts });

    const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
            thinkingConfig: { thinkingBudget: 0 }, // voice UX: favour latency
        },
    };

    for (const model of MODELS()) {
        for (const withThinking of [true, false]) {
            const b = withThinking ? body : { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: undefined } };
            try {
                const { data } = await axios.post(`${BASE}/${model}:generateContent`, b, {
                    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
                    timeout: 25000,
                });
                const out = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
                if (!out) return null;
                if (!schema) return { text: out, model };
                try {
                    return { json: JSON.parse(out), model };
                } catch {
                    const m = out.match(/\{[\s\S]*\}/);
                    return m ? { json: JSON.parse(m[0]), model } : null;
                }
            } catch (e) {
                const status = e.response?.status;
                const msg = e.response?.data?.error?.message || e.message;
                console.error(`[llm] ${model} (thinkingCfg=${withThinking}) failed: ${status} ${msg}`);
                if (status === 400 && withThinking && /thinking/i.test(msg)) continue; // retry without thinkingConfig
                if (status === 404 || status === 400) break; // try next model
                if (status === 429 || status === 401 || status === 403) return null; // quota/auth: fall back
                return null;
            }
        }
    }
    return null;
}

module.exports = { generate, isConfigured };
