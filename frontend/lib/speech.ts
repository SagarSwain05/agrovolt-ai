'use client';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Speech I/O for English, Hindi and Odia
//
// Listening:  Browser SpeechRecognition (Chrome/Edge/Android; en-IN, hi-IN,
//             or-IN). Elsewhere we record audio and the server transcribes it.
// Speaking:   en/hi → server neural voices (Edge en-IN / hi-IN), browser voice
//             as fallback. or → server voice (Bhashini / Gemini TTS, cached),
//             then the on-device Meta MMS-TTS Odia model (ONNX, ~38 MB, cached,
//             works offline).
// ═══════════════════════════════════════════════════════════════════════════
import { assistantAPI, type Lang } from './api';

const SPEECH_CODE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' };

// ── Recognition ────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognitionCtor(): any {
    if (typeof window === 'undefined') return null;
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function canBrowserListen() {
    return !!getRecognitionCtor();
}

export function canRecordAudio() {
    return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export interface Listener {
    stop: () => void;
}

/** Live speech recognition. onFinal fires once with the full utterance. */
export function listen(lang: Lang, h: {
    onInterim?: (t: string) => void;
    onFinal: (t: string) => void;
    onError?: (code: string) => void;
    onEnd?: () => void;
}): Listener | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;
    const rec = new Ctor();
    rec.lang = SPEECH_CODE[lang];
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e: any) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript;
            else interim += r[0].transcript;
        }
        h.onInterim?.((finalText + ' ' + interim).trim());
    };
    rec.onerror = (e: any) => h.onError?.(e.error || 'error');
    rec.onend = () => {
        if (finalText.trim()) h.onFinal(finalText.trim());
        h.onEnd?.();
    };
    rec.start();
    return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Record microphone audio (for server-side transcription). */
export async function startRecording(maxMs = 15000): Promise<{ stop: () => Promise<{ mimeType: string; data: string } | null> }> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
    const auto = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
    return {
        stop: () => new Promise((resolve) => {
            clearTimeout(auto);
            const finish = async () => {
                stream.getTracks().forEach((t) => t.stop());
                if (!chunks.length) return resolve(null);
                const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
                const data = await blobToBase64(blob);
                resolve({ mimeType: blob.type, data });
            };
            if (rec.state === 'inactive') finish();
            else { rec.onstop = finish; rec.stop(); }
        }),
    };
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

// ── Odia text normalisation (the Odia TTS vocabulary has letters only) ─────

const OR_UNITS = ['ଶୂନ', 'ଏକ', 'ଦୁଇ', 'ତିନି', 'ଚାରି', 'ପାଞ୍ଚ', 'ଛଅ', 'ସାତ', 'ଆଠ', 'ନଅ', 'ଦଶ', 'ଏଗାର', 'ବାର', 'ତେର', 'ଚଉଦ', 'ପନ୍ଦର', 'ଷୋହଳ', 'ସତର', 'ଅଠର', 'ଉଣେଇଶି',
    'କୋଡ଼ିଏ', 'ଏକୋଇଶି', 'ବାଇଶି', 'ତେଇଶି', 'ଚବିଶି', 'ପଚିଶି', 'ଛବିଶି', 'ସତାଇଶି', 'ଅଠାଇଶି', 'ଅଣତିରିଶି', 'ତିରିଶି', 'ଏକତିରିଶି', 'ବତିଶି', 'ତେତିଶି', 'ଚଉତିରିଶି', 'ପଇଁତିରିଶି', 'ଛତିଶି', 'ସଇଁତିରିଶି', 'ଅଠତିରିଶି', 'ଅଣଚାଳିଶି',
    'ଚାଳିଶି', 'ଏକଚାଳିଶି', 'ବୟାଳିଶି', 'ତେୟାଳିଶି', 'ଚଉରାଳିଶି', 'ପଞ୍ଚଚାଳିଶି', 'ଛୟାଳିଶି', 'ସତଚାଳିଶି', 'ଅଠଚାଳିଶି', 'ଅଣଚାଶ', 'ପଚାଶ', 'ଏକାବନ', 'ବାଉନ', 'ତେପନ', 'ଚଉବନ', 'ପଞ୍ଚାବନ', 'ଛପନ', 'ସତାବନ', 'ଅଠାବନ', 'ଅଣଷଠି',
    'ଷାଠିଏ', 'ଏକଷଠି', 'ବାଷଠି', 'ତେଷଠି', 'ଚଉଷଠି', 'ପଞ୍ଚଷଠି', 'ଛଅଷଠି', 'ସତଷଠି', 'ଅଠଷଠି', 'ଅଣସ୍ତରୀ', 'ସତୁରୀ', 'ଏକସ୍ତରୀ', 'ବାସ୍ତରୀ', 'ତେସ୍ତରୀ', 'ଚଉସ୍ତରୀ', 'ପଞ୍ଚସ୍ତରୀ', 'ଛଅସ୍ତରୀ', 'ସତସ୍ତରୀ', 'ଅଠସ୍ତରୀ', 'ଅଣାଅଶୀ',
    'ଅଶୀ', 'ଏକାଅଶୀ', 'ବୟାଅଶୀ', 'ତେୟାଅଶୀ', 'ଚଉରାଅଶୀ', 'ପଞ୍ଚାଅଶୀ', 'ଛୟାଅଶୀ', 'ସତାଅଶୀ', 'ଅଠାଅଶୀ', 'ଅଣାନବେ', 'ନବେ', 'ଏକାନବେ', 'ବୟାନବେ', 'ତେୟାନବେ', 'ଚଉରାନବେ', 'ପଞ୍ଚାନବେ', 'ଛୟାନବେ', 'ସତାନବେ', 'ଅଠାନବେ', 'ଅନେଶତ'];

function odiaInt(n: number): string {
    if (n < 100) return OR_UNITS[n];
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const hundred = Math.floor(n / 100); n %= 100;
    if (crore) parts.push(odiaInt(crore), 'କୋଟି');
    if (lakh) parts.push(OR_UNITS[lakh], 'ଲକ୍ଷ');
    if (thousand) parts.push(OR_UNITS[thousand], 'ହଜାର');
    if (hundred) parts.push(hundred === 1 ? 'ଏକ ଶହ' : `${OR_UNITS[hundred]} ଶହ`);
    if (n) parts.push(OR_UNITS[n]);
    return parts.join(' ');
}

function odiaNumber(s: string): string {
    const clean = s.replace(/,/g, '');
    const [i, d] = clean.split('.');
    let out = odiaInt(parseInt(i, 10) || 0);
    if (d) out += ' ଦଶମିକ ' + d.split('').map((c) => OR_UNITS[Number(c)]).join(' ');
    return out;
}

const OR_ODIA_DIGITS = '୦୧୨୩୪୫୬୭୮୯';

export function normalizeOdiaForTts(text: string): string {
    return text
        .replace(/[୦-୯]/g, (c) => String(OR_ODIA_DIGITS.indexOf(c)))
        .replace(/₹\s?([\d,]+(?:\.\d+)?)/g, (_, n) => `${odiaNumber(n)} ଟଙ୍କା`)
        .replace(/([\d,]+(?:\.\d+)?)\s?°\s?C/g, (_, n) => `${odiaNumber(n)} ଡିଗ୍ରୀ`)
        .replace(/([\d,]+(?:\.\d+)?)\s?%/g, (_, n) => `${odiaNumber(n)} ପ୍ରତିଶତ`)
        .replace(/([\d,]+(?:\.\d+)?)\s?kWh\/m²/gi, (_, n) => `${odiaNumber(n)} ୟୁନିଟ ଖରା`)
        .replace(/([\d,]+(?:\.\d+)?)\s?kWh/gi, (_, n) => `${odiaNumber(n)} ୟୁନିଟ`)
        .replace(/([\d,]+(?:\.\d+)?)\s?kW/gi, (_, n) => `${odiaNumber(n)} କିଲୋୱାଟ`)
        .replace(/([\d,]+(?:\.\d+)?)\s?W\b/g, (_, n) => `${odiaNumber(n)} ୱାଟ`)
        .replace(/([\d,]+(?:\.\d+)?)\s?mm\b/gi, (_, n) => `${odiaNumber(n)} ମିଲିମିଟର`)
        .replace(/([\d,]+(?:\.\d+)?)\s?km\b/gi, (_, n) => `${odiaNumber(n)} କିଲୋମିଟର`)
        .replace(/([\d,]+(?:\.\d+)?)\s?kg\b/gi, (_, n) => `${odiaNumber(n)} କିଲୋ`)
        .replace(/(\d+)\s?[–-]\s?(\d+)/g, (_, a, b) => `${odiaNumber(a)} ରୁ ${odiaNumber(b)}`)
        .replace(/[\d,]+(?:\.\d+)?/g, (n) => odiaNumber(n))
        .replace(/CO₂|CO2/g, 'କାର୍ବନ ଡାଇଅକ୍ସାଇଡ');
}

// ── In-browser Odia TTS (MMS-TTS ory, ONNX) ────────────────────────────────

const ORT_VERSION = '1.30.0';
const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_BASE = '/models/mms-tts-ory/';
const SAMPLE_RATE = 16000;

/* eslint-disable @typescript-eslint/no-explicit-any */
let odiaEngine: Promise<{ session: any; ort: any; vocab: Record<string, number> }> | null = null;
let odiaEngineReady = false;

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
    });
}

export function loadOdiaEngine() {
    if (!odiaEngine) {
        odiaEngine = (async () => {
            await loadScript(ORT_CDN + 'ort.wasm.min.js');
            const ort = (window as any).ort;
            ort.env.wasm.wasmPaths = ORT_CDN;
            ort.env.wasm.numThreads = 1;
            const [vocab, model] = await Promise.all([
                fetch(MODEL_BASE + 'vocab.json').then((r) => r.json()),
                fetch(MODEL_BASE + 'model.onnx').then((r) => {
                    if (!r.ok) throw new Error('Odia model unavailable');
                    return r.arrayBuffer();
                }),
            ]);
            const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
            odiaEngineReady = true;
            return { session, ort, vocab };
        })();
        odiaEngine.catch(() => { odiaEngine = null; });
    }
    return odiaEngine;
}

export function isOdiaEngineReady() {
    return odiaEngineReady;
}

function tokenizeOdia(text: string, vocab: Record<string, number>): number[] {
    const ids: number[] = [];
    for (const ch of text.toLowerCase()) if (ch in vocab) ids.push(vocab[ch]);
    const out = new Array(ids.length * 2 + 1).fill(0); // VITS add_blank: interleave pad id 0
    ids.forEach((id, i) => { out[2 * i + 1] = id; });
    return out;
}

async function synthOdiaChunk(text: string): Promise<Float32Array | null> {
    const { session, ort, vocab } = await loadOdiaEngine();
    const ids = tokenizeOdia(text, vocab);
    if (ids.length < 3) return null;
    const shape = [1, ids.length];
    const out = await session.run({
        input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map((x) => BigInt(x))), shape),
        attention_mask: new ort.Tensor('int64', BigInt64Array.from(ids.map(() => BigInt(1))), shape),
    });
    return out.waveform.data as Float32Array;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Playback ───────────────────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let speakToken = 0;

export function stopSpeaking() {
    speakToken++;
    try { currentAudio?.pause(); } catch { /* ignore */ }
    currentAudio = null;
    try { currentSource?.stop(); } catch { /* ignore */ }
    currentSource = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

function playBlob(blob: Blob, token: number): Promise<void> {
    return new Promise((resolve, reject) => {
        if (token !== speakToken) return resolve();
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        currentAudio = a;
        a.onended = () => { URL.revokeObjectURL(url); resolve(); };
        a.onerror = () => { URL.revokeObjectURL(url); reject(new Error('playback failed')); };
        a.play().catch(reject);
    });
}

function playPcm(pcm: Float32Array, token: number): Promise<void> {
    return new Promise((resolve) => {
        if (token !== speakToken) return resolve();
        audioCtx = audioCtx || new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const buf = audioCtx.createBuffer(1, pcm.length, SAMPLE_RATE);
        buf.copyToChannel(new Float32Array(pcm), 0);
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(audioCtx.destination);
        src.onended = () => resolve();
        currentSource = src;
        src.start();
    });
}

function browserSpeak(text: string, lang: Lang, token: number): Promise<boolean> {
    return new Promise((resolve) => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
        if (!synth || token !== speakToken) return resolve(false);
        const voice = synth.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(SPEECH_CODE[lang].toLowerCase().slice(0, 2)));
        if (!voice && lang !== 'en') return resolve(false);
        const u = new SpeechSynthesisUtterance(text);
        u.lang = SPEECH_CODE[lang];
        if (voice) u.voice = voice;
        u.rate = 0.95;
        u.onend = () => resolve(true);
        u.onerror = () => resolve(false);
        synth.speak(u);
    });
}

function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[।.!?])\s+/)
        .flatMap((s) => (s.length > 180 ? s.split(/(?<=[,;—])\s+/) : [s]))
        .map((s) => s.trim())
        .filter(Boolean);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

/**
 * Speak `text` in `lang`. Resolves when playback finishes (or is stopped).
 * Returns which engine was used.
 */
export async function speak(text: string, lang: Lang): Promise<'neural' | 'odia-local' | 'odia-server' | 'browser' | 'none'> {
    stopSpeaking();
    const token = ++speakToken;
    if (!text?.trim()) return 'none';

    if (lang === 'or') {
        // 1) Server voice (Bhashini / Gemini — commercially licensable, best pronunciation)
        if (typeof navigator === 'undefined' || navigator.onLine) {
            try {
                const res = await withTimeout(assistantAPI.tts(text, 'or'), 25000);
                if (token !== speakToken) return 'odia-server';
                await playBlob(res.data as Blob, token);
                return 'odia-server';
            } catch { /* fall through to the on-device model */ }
        }
        // 2) On-device Meta MMS model — only if the farmer already downloaded it
        //    (never pull 38 MB over mobile data as an automatic fallback)
        try {
            const cached = 'caches' in window && !!(await (await caches.open('av-models')).match('/models/mms-tts-ory/model.onnx'));
            if (!cached && !odiaEngineReady) {
                if (navigator.onLine) {
                    const res = await assistantAPI.tts(text, 'or', 'edge'); // Hindi voice reading transliterated Odia
                    await playBlob(res.data as Blob, token);
                    return 'odia-server';
                }
                return 'none';
            }
            await loadOdiaEngine();
            const parts = splitSentences(normalizeOdiaForTts(text));
            let next = synthOdiaChunk(parts[0]);
            for (let i = 0; i < parts.length; i++) {
                const pcm = await next;
                if (token !== speakToken) return 'odia-local';
                if (i + 1 < parts.length) next = synthOdiaChunk(parts[i + 1]);
                if (pcm) await playPcm(pcm, token);
            }
            return 'odia-local';
        } catch {
            return 'none';
        }
    }

    try {
        const res = await assistantAPI.tts(text, lang);
        await playBlob(res.data as Blob, token);
        return 'neural';
    } catch {
        return (await browserSpeak(text, lang, token)) ? 'browser' : 'none';
    }
}
