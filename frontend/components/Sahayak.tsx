'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assistantAPI, apiError, type Lang } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import {
    listen, canBrowserListen, canRecordAudio, startRecording, speak, stopSpeaking,
    loadOdiaEngine, isOdiaEngineReady, type Listener,
} from '@/lib/speech';
import { Mic, MicOff, X, Send, Volume2, VolumeX, Sparkles, Loader2, Repeat, Square, Headphones } from 'lucide-react';

interface Msg {
    role: 'user' | 'assistant';
    text: string;
    lang: Lang;
    source?: string;
    error?: boolean;
}

const STORE = 'agrovolt_sahayak_v2';
const SUGGESTIONS = ['sahayak.q.today', 'sahayak.q.weather', 'sahayak.q.solar', 'sahayak.q.market', 'sahayak.q.irrigate', 'sahayak.q.carbon'];

type Mode = 'idle' | 'listening' | 'recording' | 'thinking' | 'speaking';

export default function Sahayak() {
    const { t, lang } = useI18n();
    const [open, setOpen] = useState(false);
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [interim, setInterim] = useState('');
    const [mode, setMode] = useState<Mode>('idle');
    const [autoSpeak, setAutoSpeak] = useState(true);
    const [handsFree, setHandsFree] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [engine, setEngine] = useState<{ llm: string; serverStt: boolean } | null>(null);
    const [odiaVoice, setOdiaVoice] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
    const listenerRef = useRef<Listener | null>(null);
    const recorderRef = useRef<{ stop: () => Promise<{ mimeType: string; data: string } | null> } | null>(null);
    const handsFreeRef = useRef(handsFree);
    const scrollRef = useRef<HTMLDivElement>(null);
    handsFreeRef.current = handsFree;

    // Restore conversation + preferences
    useEffect(() => {
        try {
            const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
            if (s?.msgs) setMsgs(s.msgs);
            if (typeof s?.autoSpeak === 'boolean') setAutoSpeak(s.autoSpeak);
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        try { sessionStorage.setItem(STORE, JSON.stringify({ msgs: msgs.slice(-30), autoSpeak })); } catch { /* ignore */ }
    }, [msgs, autoSpeak]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [msgs, interim, mode]);

    useEffect(() => {
        if (!open || engine) return;
        assistantAPI.status().then((r) => setEngine(r.data.data)).catch(() => { });
    }, [open, engine]);

    // Warm the in-browser Odia voice as soon as Odia is in use
    useEffect(() => {
        if (!open || lang !== 'or' || isOdiaEngineReady()) {
            if (isOdiaEngineReady()) setOdiaVoice('ready');
            return;
        }
        setOdiaVoice('loading');
        loadOdiaEngine().then(() => setOdiaVoice('ready')).catch(() => setOdiaVoice('failed'));
    }, [open, lang]);

    const stopAll = useCallback(() => {
        listenerRef.current?.stop();
        listenerRef.current = null;
        stopSpeaking();
    }, []);

    useEffect(() => () => stopAll(), [stopAll]);

    const startVoiceRef = useRef<() => void>(() => { });

    const ask = useCallback(async (payload: { message?: string; audio?: { mimeType: string; data: string } }) => {
        const history = msgs.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, text: m.text }));
        if (payload.message) setMsgs((m) => [...m, { role: 'user', text: payload.message!, lang }]);
        setMode('thinking');
        setNotice(null);
        try {
            const res = await assistantAPI.chat({ ...payload, lang, history });
            const d = res.data.data as { reply: string; transcript: string; lang: Lang; source: string };
            setMsgs((m) => {
                const next = [...m];
                if (payload.audio && d.transcript) next.push({ role: 'user', text: d.transcript, lang: d.lang });
                next.push({ role: 'assistant', text: d.reply, lang: d.lang, source: d.source });
                return next;
            });
            if (autoSpeak) {
                setMode('speaking');
                await speak(d.reply, d.lang);
            }
            setMode('idle');
            if (handsFreeRef.current) setTimeout(() => startVoiceRef.current(), 350);
        } catch (e) {
            const err = e as { response?: { data?: { code?: string } } };
            const msg = err.response?.data?.code === 'speech_unavailable' ? t('sahayak.err.serverStt') : apiError(e, t('sahayak.err.generic'));
            setMsgs((m) => [...m, { role: 'assistant', text: msg, lang, error: true }]);
            setMode('idle');
            setHandsFree(false);
        }
    }, [msgs, lang, autoSpeak, t]);

    const send = (text?: string) => {
        const q = (text ?? input).trim();
        if (!q || mode === 'thinking') return;
        setInput('');
        stopAll();
        ask({ message: q });
    };

    const startVoice = useCallback(async () => {
        stopAll();
        setNotice(null);
        setInterim('');
        if (canBrowserListen()) {
            setMode('listening');
            listenerRef.current = listen(lang, {
                onInterim: setInterim,
                onFinal: (txt) => { setInterim(''); ask({ message: txt }); },
                onError: (code) => {
                    setMode('idle');
                    setHandsFree(false);
                    if (code === 'not-allowed' || code === 'service-not-allowed') setNotice(t('sahayak.err.micDenied'));
                    else if (code === 'language-not-supported') setNotice(t('sahayak.err.langUnsupported'));
                    else if (code !== 'no-speech' && code !== 'aborted') setNotice(t('sahayak.err.listen'));
                },
                onEnd: () => setMode((m) => (m === 'listening' ? 'idle' : m)),
            });
            return;
        }
        if (canRecordAudio() && engine?.serverStt) {
            try {
                recorderRef.current = await startRecording();
                setMode('recording');
            } catch {
                setNotice(t('sahayak.err.micDenied'));
            }
            return;
        }
        setNotice(t('sahayak.err.noVoice'));
    }, [lang, ask, stopAll, t, engine]);
    startVoiceRef.current = startVoice;

    const stopVoice = async () => {
        if (mode === 'listening') {
            listenerRef.current?.stop();
            return;
        }
        if (mode === 'recording' && recorderRef.current) {
            const audio = await recorderRef.current.stop();
            recorderRef.current = null;
            if (audio) ask({ audio });
            else setMode('idle');
        }
    };

    const micActive = mode === 'listening' || mode === 'recording';

    const toggleHandsFree = () => {
        const next = !handsFree;
        setHandsFree(next);
        if (next) { setAutoSpeak(true); if (mode === 'idle') startVoice(); }
        else stopAll();
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => { setOpen(!open); if (open) { stopAll(); setHandsFree(false); setMode('idle'); } }}
                aria-label={t('sahayak.open')}
                className="sahayak-fab"
                style={{
                    position: 'fixed', right: '1.25rem', width: '56px', height: '56px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-green-600), var(--color-green-800))', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    boxShadow: micActive ? '0 0 0 6px rgba(16,185,129,0.25), 0 6px 20px rgba(5,150,105,0.45)' : '0 6px 20px rgba(5,150,105,0.45)', zIndex: 100,
                    transition: 'all 0.25s ease',
                }}
            >
                {open ? <X size={22} /> : <Mic size={22} />}
            </button>
            <style>{`
                .sahayak-fab { bottom: 1.5rem; }
                @media (max-width: 767px) { .sahayak-fab { bottom: 88px; } }
                .sahayak-panel { right: 1.25rem; bottom: 6rem; width: 390px; height: min(620px, calc(100vh - 8rem)); border-radius: var(--radius-2xl); }
                @media (max-width: 767px) { .sahayak-panel { left: 0; right: 0; bottom: 0; top: 0; width: 100%; height: 100%; border-radius: 0; } }
                @keyframes sahayakPulse { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.12); opacity: 1 } }
                @keyframes sahayakBar { 0%,100% { height: 6px } 50% { height: 18px } }
            `}</style>

            {open && (
                <div className="sahayak-panel" role="dialog" aria-label="Sahayak" style={{
                    position: 'fixed', background: 'white', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-gray-200)',
                    zIndex: 101, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn 0.2s ease forwards',
                }}>
                    {/* Header */}
                    <div style={{ padding: '0.875rem 1rem', background: 'linear-gradient(135deg, var(--color-green-700), var(--color-green-900))', color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={18} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700 }}>{t('sahayak.title')}</div>
                                <div style={{ fontSize: '0.6875rem', opacity: 0.75 }}>
                                    {engine ? (engine.llm === 'gemini' ? t('sahayak.engine.ai') : t('sahayak.engine.rules')) : t('sahayak.subtitle')}
                                </div>
                            </div>
                            <button onClick={() => setAutoSpeak(!autoSpeak)} title={autoSpeak ? t('sahayak.mute') : t('sahayak.unmute')} style={iconBtn}>
                                {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            </button>
                            <button onClick={() => { setOpen(false); stopAll(); setHandsFree(false); setMode('idle'); }} aria-label={t('common.close')} style={iconBtn}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <LanguageSwitcher variant="dark" full />
                            <button onClick={toggleHandsFree} style={{
                                ...iconBtn, width: 'auto', padding: '0.3rem 0.625rem', gap: '0.3rem', fontSize: '0.6875rem', fontWeight: 600,
                                background: handsFree ? 'white' : 'rgba(255,255,255,0.12)', color: handsFree ? 'var(--color-green-800)' : 'white',
                            }}>
                                <Headphones size={13} /> {t('sahayak.handsFree')}
                            </button>
                        </div>
                        {lang === 'or' && odiaVoice === 'loading' && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Loader2 size={12} className="animate-spin" /> {t('sahayak.odiaLoading')}
                            </div>
                        )}
                    </div>

                    {/* Conversation */}
                    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', background: 'var(--color-gray-50)' }}>
                        {msgs.length === 0 && (
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', lineHeight: 1.6, background: 'white', padding: '0.875rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                                {t('sahayak.welcome')}
                            </div>
                        )}
                        {msgs.map((m, i) => (
                            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                                <div style={{
                                    padding: '0.625rem 0.875rem', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    background: m.role === 'user' ? 'var(--color-green-600)' : m.error ? 'var(--color-red-50)' : 'white',
                                    color: m.role === 'user' ? 'white' : m.error ? 'var(--color-red-600)' : 'var(--color-gray-800)',
                                    border: m.role === 'user' ? 'none' : '1px solid var(--color-gray-200)',
                                    fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                }}>
                                    {m.text}
                                </div>
                                {m.role === 'assistant' && !m.error && (
                                    <button onClick={async () => { setMode('speaking'); await speak(m.text, m.lang); setMode('idle'); }}
                                        style={{ marginTop: '0.25rem', border: 'none', background: 'none', color: 'var(--color-gray-400)', fontSize: '0.6875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Repeat size={11} /> {t('sahayak.replay')}
                                    </button>
                                )}
                            </div>
                        ))}
                        {interim && (
                            <div style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: '0.5rem 0.75rem', borderRadius: '14px', background: 'var(--color-green-50)', color: 'var(--color-green-800)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                {interim}…
                            </div>
                        )}
                        {mode === 'thinking' && (
                            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-gray-500)', fontSize: '0.8125rem' }}>
                                <Loader2 size={14} className="animate-spin" /> {t('sahayak.thinking')}
                            </div>
                        )}
                    </div>

                    {/* Suggestions */}
                    <div className="scrollbar-hide" style={{ display: 'flex', gap: '0.375rem', padding: '0.5rem 0.75rem', overflowX: 'auto', borderTop: '1px solid var(--color-gray-100)', background: 'white' }}>
                        {SUGGESTIONS.map((k) => (
                            <button key={k} onClick={() => send(t(k))} disabled={mode === 'thinking'} style={{
                                flexShrink: 0, padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid var(--color-green-200)',
                                background: 'var(--color-green-50)', color: 'var(--color-green-800)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>{t(k)}</button>
                        ))}
                    </div>

                    {notice && (
                        <div style={{ padding: '0.5rem 0.875rem', fontSize: '0.75rem', color: 'var(--color-solar-700)', background: 'var(--color-solar-50)', borderTop: '1px solid var(--color-solar-200)' }}>
                            {notice}
                        </div>
                    )}

                    {/* Composer */}
                    <div style={{ padding: '0.625rem 0.75rem', borderTop: '1px solid var(--color-gray-200)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white' }}>
                        <button
                            onClick={micActive ? stopVoice : mode === 'speaking' ? () => { stopSpeaking(); setMode('idle'); } : startVoice}
                            disabled={mode === 'thinking'}
                            aria-label={micActive ? t('sahayak.stop') : t('sahayak.speak')}
                            style={{
                                width: '46px', height: '46px', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                background: micActive ? 'var(--color-red-500)' : mode === 'speaking' ? 'var(--color-solar-500)' : 'var(--color-green-600)',
                                animation: micActive ? 'sahayakPulse 1.2s ease infinite' : 'none',
                            }}
                        >
                            {micActive ? <MicOff size={20} /> : mode === 'speaking' ? <Square size={16} /> : <Mic size={20} />}
                        </button>
                        {micActive ? (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gray-600)', fontSize: '0.8125rem' }}>
                                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', height: '18px' }}>
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <span key={i} style={{ width: '3px', background: 'var(--color-green-500)', borderRadius: '2px', animation: `sahayakBar 0.9s ease ${i * 0.12}s infinite` }} />
                                    ))}
                                </span>
                                {mode === 'recording' ? t('sahayak.recording') : t('sahayak.listening')}
                            </div>
                        ) : (
                            <>
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && send()}
                                    placeholder={t('sahayak.placeholder')}
                                    className="input"
                                    style={{ flex: 1, minWidth: 0, fontSize: '0.875rem' }}
                                />
                                <button onClick={() => send()} disabled={!input.trim() || mode === 'thinking'} aria-label={t('sahayak.send')} style={{
                                    width: '40px', height: '40px', borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                                    background: input.trim() ? 'var(--color-green-600)' : 'var(--color-gray-200)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Send size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

const iconBtn: React.CSSProperties = {
    width: '30px', height: '30px', borderRadius: '999px', border: 'none', cursor: 'pointer',
    background: 'rgba(255,255,255,0.12)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
