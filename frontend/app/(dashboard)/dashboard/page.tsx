'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { dashboardAPI } from '@/lib/api';
import { useApi, useTelemetry, type SensorReading } from '@/hooks/useLive';
import { speak, stopSpeaking } from '@/lib/speech';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
    Zap, Droplets, Leaf, IndianRupee, Thermometer, Sun, CloudRain, Cloud, CloudSun, Moon, Gauge, Sprout,
    AlertTriangle, TrendingUp, Wrench, ScanLine, Settings2, Volume2, Square, Radio, Cpu, ArrowRight, Loader2,
    CheckCircle2, Circle, ShieldCheck, WifiOff,
} from 'lucide-react';
import { useOnline } from '@/lib/pwa';

const DONE_KEY = 'agrovolt_tasks_done';
function loadDone(): Set<string> {
    try {
        const v = JSON.parse(localStorage.getItem(DONE_KEY) || 'null');
        return v?.day === new Date().toDateString() ? new Set(v.ids) : new Set();
    } catch { return new Set(); }
}

interface Action { code: string; type: string; priority: number; text: string }
interface Forecast { date: string; day: string; tempMax: number; tempMin: number; rain: number; rainChance: number | null; description: string; radiationKwhM2: number; icon: string }
interface Dash {
    farm: { name: string; district?: string; state?: string; cropUnderPanels?: string; shadeCoveragePct?: number };
    weather: { temperature: number; feelsLike: number; humidity: number; windSpeed: number; description: string; isDay: boolean; location: string; sunrise: string; sunset: string; irradiance: number } | null;
    forecast: Forecast[];
    sensors: SensorReading | null;
    solar: null | {
        capacityKW: number; tilt: number; optimalTilt: number; todayKwh: number; powerW: number; panelTempC?: number; bioCoolingDeltaC?: number; tariffPerKwh: number;
        last30: { energyKwh: number; revenue: number; waterSavedL: number; bioCoolingGainKwh: number };
        daily: { day: string; kwh: number; revenue: number; partial?: boolean }[];
    };
    carbon: { credits: number; co2AvoidedKg: number; valueInr: number; waterSavedL: number };
    market: { crop: string; currentPrice: number; signal: string; pctChange: number; bestMandi?: string; source: string };
    scans: { crop: string; disease: string; date: string; severity: string }[];
    actions: Action[];
    income: { solar30: number; carbonValue: number; todaySolar: number; total30: number };
    hardware?: { verified: boolean; since: string | null; calibration: { irradianceFactor?: number; irradianceDays?: number; samples?: number } | null };
}

const ACTION_STYLE: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    water: { icon: <Droplets size={16} />, color: 'var(--color-blue-600)', bg: 'var(--color-blue-50)' },
    alert: { icon: <AlertTriangle size={16} />, color: 'var(--color-red-600)', bg: 'var(--color-red-50)' },
    solar: { icon: <Sun size={16} />, color: 'var(--color-solar-600)', bg: 'var(--color-solar-50)' },
    market: { icon: <TrendingUp size={16} />, color: 'var(--color-green-700)', bg: 'var(--color-green-50)' },
    crop: { icon: <Sprout size={16} />, color: 'var(--color-green-700)', bg: 'var(--color-green-50)' },
    setup: { icon: <Wrench size={16} />, color: 'var(--color-gray-700)', bg: 'var(--color-gray-100)' },
    info: { icon: <Leaf size={16} />, color: 'var(--color-green-700)', bg: 'var(--color-green-50)' },
};

function wxIcon(desc: string, night = false, size = 18) {
    const d = desc.toLowerCase();
    if (d.includes('rain') || d.includes('drizzle') || d.includes('thunder')) return <CloudRain size={size} color="var(--color-blue-500)" />;
    if (night) return <Moon size={size} color="var(--color-blue-400)" />;
    if (d.includes('overcast') || d.includes('fog')) return <Cloud size={size} color="var(--color-gray-400)" />;
    if (d.includes('partly') || d.includes('mainly')) return <CloudSun size={size} color="var(--color-solar-500)" />;
    return <Sun size={size} color="var(--color-solar-500)" />;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { t, lang, num, date } = useI18n();
    const { data, error, loading, updatedAt } = useApi<Dash>(() => dashboardAPI.get(lang), [lang], 120000);
    const { reading: live, connected } = useTelemetry(data?.sensors);
    const [speaking, setSpeaking] = useState(false);
    const [done, setDone] = useState<Set<string>>(new Set());
    const online = useOnline();
    useEffect(() => { setDone(loadDone()); }, []);
    const toggleDone = (id: string) => setDone((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        try { localStorage.setItem(DONE_KEY, JSON.stringify({ day: new Date().toDateString(), ids: Array.from(n) })); } catch { /* storage unavailable */ }
        return n;
    });

    const sensors = live || data?.sensors || null;
    const solar = data?.solar;
    const chart = useMemo(() => (solar?.daily || []).map((d) => ({ ...d, label: date(d.day) })), [solar, date]);

    const readActions = async () => {
        if (speaking) { stopSpeaking(); setSpeaking(false); return; }
        if (!data) return;
        setSpeaking(true);
        const w = data.weather;
        const intro = w ? t('dash.briefIntro', { name: user?.name?.split(' ')[0] || '', temp: w.temperature }) : '';
        await speak([intro, ...data.actions.slice(0, 3).map((a) => a.text)].join(' '), lang);
        setSpeaking(false);
    };

    const greetingKey = (() => {
        const h = new Date().getHours();
        return h < 12 ? 'dash.goodMorning' : h < 17 ? 'dash.goodAfternoon' : 'dash.goodEvening';
    })();

    return (
        <div>
            <Navbar
                title={`${t(greetingKey)}, ${user?.name?.split(' ')[0] || ''}`}
                subtitle={data ? `${data.farm.name}${data.farm.district ? ' · ' + data.farm.district : ''}` : t('common.loading')}
                temperature={data?.weather?.temperature}
                isNight={data?.weather ? !data.weather.isDay : undefined}
            />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {error && !data && <div className="card" style={{ color: 'var(--color-red-600)' }}>{t('common.loadError')}: {error}</div>}
                {loading && !data && (
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gray-500)' }}>
                        <Loader2 size={16} className="animate-spin" /> {t('dash.loadingLive')}
                    </div>
                )}

                {data && (
                    <>
                        {/* ── Income + live stats ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="green" icon={<IndianRupee size={18} />} label={t('dash.solarIncomeToday')}
                                value={`₹${num(data.income.todaySolar)}`} subValue={solar ? t('dash.kwhToday', { kwh: num(sensors?.energyTodayKwh ?? solar.todayKwh, 1) }) : t('dash.noSolar')} />
                            <StatCard variant="solar" icon={<Zap size={18} />} label={t('dash.powerNow')}
                                value={solar ? `${num(sensors?.powerW ?? solar.powerW)} W` : '—'} subValue={solar ? t('dash.ofCapacity', { kw: solar.capacityKW }) : ''} />
                            <StatCard variant="blue" icon={<Droplets size={18} />} label={t('dash.waterSaved30')}
                                value={`${num(solar?.last30.waterSavedL ?? 0)} L`} subValue={t('dash.byPanelShade')} />
                            <StatCard variant="green" icon={<Leaf size={18} />} label={t('dash.carbonCredits')}
                                value={num(data.carbon.credits, 3)} subValue={`≈ ₹${num(data.carbon.valueInr)}`} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            {/* ── AI action queue ── */}
                            <div className="card lg:col-span-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <h2 style={h2}>{t('dash.actionsTitle')}</h2>
                                    <button onClick={readActions} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                        {speaking ? <><Square size={13} /> {t('common.stop')}</> : <><Volume2 size={14} /> {t('dash.listen')}</>}
                                    </button>
                                </div>
                                {!online && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}><WifiOff size={12} /> {t('pwa.savedData')}</div>}
                                {data.actions.map((a, i) => {
                                    const st = ACTION_STYLE[a.type] || ACTION_STYLE.info;
                                    const id = `${a.code}:${a.text.slice(0, 40)}`;
                                    const isDone = done.has(id);
                                    return (
                                        <div key={a.code + i} style={{ display: 'flex', gap: '0.625rem', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: st.bg, alignItems: 'flex-start', opacity: isDone ? 0.55 : 1 }}>
                                            <button onClick={() => toggleDone(id)} aria-label={t('dash.markDone')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: isDone ? 'var(--color-green-600)' : st.color, flexShrink: 0, marginTop: 1 }}>
                                                {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </button>
                                            <div style={{ color: st.color, marginTop: '2px', flexShrink: 0 }}>{st.icon}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--color-gray-800)', lineHeight: 1.55, flex: 1, textDecoration: isDone ? 'line-through' : 'none' }}>{a.text}</div>
                                            <button onClick={() => speak(a.text, lang)} aria-label={t('dash.listen')} style={{ border: 'none', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: st.color }}>
                                                <Volume2 size={14} />
                                            </button>
                                            {a.type === 'setup' && <Link href="/settings" style={{ color: st.color, flexShrink: 0 }}><ArrowRight size={16} /></Link>}
                                        </div>
                                    );
                                })}
                                <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>
                                    {updatedAt && t('common.updatedAt', { time: updatedAt.toLocaleTimeString(lang === 'en' ? 'en-IN' : lang === 'hi' ? 'hi-IN' : 'or-IN', { hour: '2-digit', minute: '2-digit' }) })}
                                </div>
                            </div>

                            {/* ── Live field sensors ── */}
                            <div className="card lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h2 style={h2}>{t('dash.liveField')}</h2>
                                    <span className={`badge ${sensors?.source === 'device' ? 'badge-green' : data.hardware?.verified ? 'badge-solar' : 'badge-blue'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--color-green-500)' : 'var(--color-gray-400)', animation: connected ? 'pulse 2s infinite' : 'none' }} />
                                        {sensors?.source === 'device' ? <><ShieldCheck size={11} /> {t('dash.sensorVerified')}</>
                                            : data.hardware?.verified ? <><Cpu size={11} /> {t('dash.sensorOffline')}</>
                                                : <><Radio size={11} /> {t('dash.sensorVirtual')}</>}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Metric icon={<Thermometer size={14} />} label={t('dash.panelTemp')} value={sensors?.panelTempC != null ? `${num(sensors.panelTempC, 1)}°C` : '—'}
                                        hint={sensors?.panelTempUncooledC != null ? t('dash.withoutCrops', { t: num(sensors.panelTempUncooledC, 1) }) : undefined} />
                                    <Metric icon={<Leaf size={14} />} label={t('dash.bioCooling')} value={sensors?.bioCoolingDeltaC != null ? `−${num(sensors.bioCoolingDeltaC, 1)}°C` : '—'} hint={t('dash.bioCoolingHint')} />
                                    <Metric icon={<Droplets size={14} />} label={t('dash.soilMoisture')} value={sensors?.soilMoisturePct != null ? `${num(sensors.soilMoisturePct, 1)}%` : '—'}
                                        hint={(sensors as { soilAvailableWaterPct?: number })?.soilAvailableWaterPct != null ? t('dash.paw', { p: (sensors as { soilAvailableWaterPct?: number }).soilAvailableWaterPct }) : sensors?.soilTempC != null ? t('dash.soilTemp', { t: num(sensors.soilTempC, 1) }) : undefined} />
                                    <Metric icon={<Sun size={14} />} label={t('dash.sunlight')} value={sensors?.irradianceWm2 != null ? `${num(sensors.irradianceWm2)} W/m²` : '—'}
                                        hint={sensors?.parCrop != null ? t('dash.parCrop', { v: num(sensors.parCrop) }) : undefined} />
                                    <Metric icon={<Thermometer size={14} />} label={t('dash.underCanopy')} value={sensors?.underCanopyTempC != null ? `${num(sensors.underCanopyTempC, 1)}°C` : '—'}
                                        hint={sensors?.ambientTempC != null ? t('dash.openAir', { t: num(sensors.ambientTempC, 1) }) : undefined} />
                                    <Metric icon={<Gauge size={14} />} label={t('dash.soilNpk')}
                                        value={sensors?.soilN != null ? `${num(sensors.soilN)}/${num(sensors.soilP)}/${num(sensors.soilK)}` : '—'}
                                        hint={sensors?.soilN != null ? 'N/P/K mg/kg' : t('dash.needsProbe')} />
                                </div>
                                {sensors?.source !== 'device' && (
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', lineHeight: 1.5 }}>
                                        {data.hardware?.verified ? t('dash.offlineNote') : t('dash.virtualNote')}{' '}
                                        {data.hardware?.calibration?.irradianceDays ? t('dash.calibrated', { f: data.hardware.calibration.irradianceFactor, d: data.hardware.calibration.irradianceDays }) : ''}{' '}
                                        <Link href="/settings#devices" style={{ color: 'var(--color-green-700)' }}>{data.hardware?.verified ? t('dash.manageDevices') : t('dash.connectDevice')}</Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Weather ── */}
                        {data.weather && (
                            <div className="card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                                    {wxIcon(data.weather.description, !data.weather.isDay, 32)}
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>{data.weather.temperature}°C</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{t('wx.' + data.weather.description.replace(/ /g, '_'))} · {data.weather.location}</div>
                                    </div>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-gray-600)', flexWrap: 'wrap' }}>
                                        <span>{t('wx.humidity')}: {data.weather.humidity}%</span>
                                        <span>{t('wx.wind')}: {data.weather.windSpeed} km/h</span>
                                        <span>{t('wx.sunrise')}: {data.weather.sunrise}</span>
                                        <span>{t('wx.sunset')}: {data.weather.sunset}</span>
                                    </div>
                                </div>
                                <div className="scrollbar-hide" style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(88px, 1fr)', gap: '0.5rem', overflowX: 'auto' }}>
                                    {data.forecast.map((f, i) => (
                                        <div key={f.date} style={{ textAlign: 'center', padding: '0.625rem 0.25rem', borderRadius: 'var(--radius-lg)', background: i === 0 ? 'var(--color-green-50)' : 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)' }}>
                                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-gray-600)' }}>{i === 0 ? t('common.today') : date(f.date, { weekday: 'short' })}</div>
                                            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.375rem 0' }}>{wxIcon(f.description)}</div>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{f.tempMax}° <span style={{ color: 'var(--color-gray-400)', fontWeight: 500 }}>{f.tempMin}°</span></div>
                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-blue-600)', marginTop: '0.125rem' }}>{f.rain >= 0.5 ? `${Math.round(f.rain)} mm` : `${f.rainChance ?? 0}%`}</div>
                                            <div style={{ fontSize: '0.625rem', color: 'var(--color-solar-600)' }}>☀ {f.radiationKwhM2}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginTop: '0.5rem' }}>{t('wx.legend')}</div>
                            </div>
                        )}

                        {/* ── Energy chart / solar setup ── */}
                        {solar ? (
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <h2 style={h2}>{t('dash.energy30')}</h2>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                        {t('dash.energy30Summary', { kwh: num(solar.last30.energyKwh), rs: num(solar.last30.revenue), cool: num(solar.last30.bioCoolingGainKwh, 1) })}
                                    </div>
                                </div>
                                <div style={{ height: 220 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="kwh" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={18} />
                                            <YAxis tick={{ fontSize: 10 }} unit="" />
                                            <Tooltip formatter={(v) => [`${v} kWh`, t("dash.energy")]} />
                                            <Area type="monotone" dataKey="kwh" stroke="#d97706" strokeWidth={2} fill="url(#kwh)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{t('dash.energyMethod')}</div>
                            </div>
                        ) : (
                            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'var(--color-solar-50)', borderColor: 'var(--color-solar-200)' }}>
                                <Sun size={28} color="var(--color-solar-600)" />
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ fontWeight: 700 }}>{t('dash.setupTitle')}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)' }}>{t('dash.setupBody')}</div>
                                </div>
                                <Link href="/settings" className="btn-solar" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Settings2 size={15} /> {t('dash.setupCta')}</Link>
                            </div>
                        )}

                        {/* ── Quick tools ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { href: '/scan', icon: <ScanLine size={18} />, label: t('nav.scan') },
                                { href: '/market', icon: <TrendingUp size={18} />, label: `${t('nav.market')} · ${t('crop.' + data.market.crop)} ₹${num(data.market.currentPrice)}` },
                                { href: '/solar', icon: <Sun size={18} />, label: t('nav.solar') },
                                { href: '/carbon', icon: <Leaf size={18} />, label: t('nav.carbon') },
                            ].map((q) => (
                                <Link key={q.href} href={q.href} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', color: 'var(--color-gray-800)', fontSize: '0.8125rem', fontWeight: 600, padding: '0.875rem' }}>
                                    <span style={{ color: 'var(--color-green-600)' }}>{q.icon}</span> <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.label}</span>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
    return (
        <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{icon} {label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-900)', marginTop: '0.125rem' }}>{value}</div>
            {hint && <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>{hint}</div>}
        </div>
    );
}
