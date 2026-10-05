'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Text-to-speech (server)
// English & Hindi: Microsoft Edge neural voices (free read-aloud service).
// Odia: the browser runs the MMS-TTS Odia model locally; this server path is
// the fallback and speaks Odia text with the Hindi voice after a 1:1 Odia →
// Devanagari transliteration (both are Brahmic scripts with parallel layouts).
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const VOICES = { en: 'en-IN-NeerjaNeural', hi: 'hi-IN-SwaraNeural', or: 'hi-IN-SwaraNeural' };
const cache = new Map(); // small LRU of recent clips
const CACHE_MAX = 60;

const ODIA_SPECIAL = {
    0x0b2f: 0x091c, // ଯ is pronounced "ja" in Odia → ज
    0x0b5f: 0x092f, // ୟ → य
    0x0b71: 0x0935, // ୱ → व
    0x0b35: 0x0935, // ଵ → व
    0x0b56: null, 0x0b57: null, // length marks: drop
};

function odiaToDevanagari(text) {
    let out = '';
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x0b00 && cp <= 0x0b7f) {
            if (cp in ODIA_SPECIAL) {
                if (ODIA_SPECIAL[cp] != null) out += String.fromCodePoint(ODIA_SPECIAL[cp]);
            } else {
                out += String.fromCodePoint(cp - 0x200);
            }
        } else out += ch;
    }
    return out;
}

function clean(text) {
    return String(text || '')
        .replace(/[*_#`>|]/g, ' ')
        .replace(/₹\s?/g, 'Rs ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1200);
}

async function synthesize(text, lang = 'en') {
    const l = VOICES[lang] ? lang : 'en';
    let input = clean(text);
    if (l === 'hi' || l === 'or') input = input.replace(/Rs /g, 'रुपये ');
    if (l === 'or') input = odiaToDevanagari(input);
    if (!input) throw new Error('Empty text');

    const key = crypto.createHash('sha1').update(l + '|' + input).digest('hex');
    if (cache.has(key)) {
        const v = cache.get(key);
        cache.delete(key);
        cache.set(key, v);
        return v;
    }
    const tts = new MsEdgeTTS();
    try {
        await tts.setMetadata(VOICES[l], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(input);
        const chunks = [];
        await new Promise((resolve, reject) => {
            audioStream.on('data', (c) => chunks.push(c));
            audioStream.on('end', resolve);
            audioStream.on('close', resolve);
            audioStream.on('error', reject);
            setTimeout(() => reject(new Error('TTS timeout')), 20000);
        });
        const buf = Buffer.concat(chunks);
        if (!buf.length) throw new Error('No audio received');
        const v = { audio: buf, voice: VOICES[l], transliterated: l === 'or' };
        cache.set(key, v);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        return v;
    } finally {
        try { tts.close(); } catch { /* already closed */ }
    }
}

module.exports = { synthesize, odiaToDevanagari };
