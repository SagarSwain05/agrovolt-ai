'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import TiltTool from '@/components/TiltTool';
import { useI18n, cropKey } from '@/lib/i18n';
import { useFarm } from '@/lib/farm';
import { solarAPI } from '@/lib/api';
import { useApi, useTelemetry } from '@/hooks/useLive';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ComposedChart, Line, Area } from 'recharts';
import { Zap, Thermometer, Compass, Sun, Leaf, ScanLine, Loader2, Settings2, CalendarDays } from 'lucide-react';

interface Opt {
    installed?: boolean;
    current: { tilt: number; efficiency: number; dailyEnergy: number; panelCount: number; capacity: number };
    optimal: { tilt: number; potentialGain: string; projectedEnergy: number };
    sunPath: { hour: number; altitude: number; azimuth: number; irradiance: number }[];
    bioCooling: { temperatureReduction: number; efficiencyGain: number; adjustedPanelTemp: number };
    hourlyToday: { hour: number; irradiance: number; powerW: number; panelTempC: number }[];
    currentHour: number;
    forecast7: { date: string; kwh: number; revenue: number; radiation: number; tempMax: number; description: string }[];
    peakSunHoursToday?: number;
    shadeCoverage: number;
    cropUnderPanels: string;
    tariffPerKwh: number;
}

export default function SolarPage() {
    const { t, num, date } = useI18n();
    const { farm, update } = useFarm();
    const { data, loading, error, reload } = useApi<Opt>(() => solarAPI.getOptimization(), [farm?.panelTilt, farm?.solarCapacityKW], 300000);
    const history = useApi<{ history: { day?: string; date: string; energyProduced: number; revenue: number; isPartial?: boolean }[]; summary: { totalEnergy: number; totalRevenue: number } }>(() => solarAPI.getHistory(30), [farm?.panelTilt, farm?.solarCapacityKW]);
    const { reading } = useTelemetry();

    const sunAlt = useMemo(() => {
        if (!data?.sunPath?.length) return undefined;
        const h = new Date().getHours();
        return data.sunPath.find((p) => p.hour === h)?.altitude ?? 0;
    }, [data]);

    const hist = (history.data?.history || []).map((d) => ({ label: date(d.day || d.date), kwh: d.energyProduced, partial: d.isPartial }));
    const hourly = (data?.hourlyToday || []).filter((h) => h.hour >= 5 && h.hour <= 19).map((h) => ({ ...h, label: `${h.hour}:00`, kw: Math.round(h.powerW / 100) / 10 }));

    if (data && data.installed === false) {
        return (
            <div>
                <Navbar title={t('nav.solar')} />
                <div className="page-container">
                    <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Sun size={32} color="var(--color-solar-500)" />
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{t('dash.setupTitle')}</div>
                            <div style={{ color: 'var(--color-gray-600)', fontSize: '0.875rem' }}>{t('dash.setupBody')}</div>
                        </div>
                        <Link href="/settings" className="btn-solar" style={{ textDecoration: 'none', display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}><Settings2 size={15} /> {t('dash.setupCta')}</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navbar title={t('nav.solar')} subtitle={data ? t('solar.subtitle', { kw: data.current.capacity, n: data.current.panelCount, crop: t(cropKey(data.cropUnderPanels)) }) : t('common.loading')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {loading && !data && <div className="card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Loader2 size={16} className="animate-spin" /> {t('common.loading')}</div>}
                {error && !data && <div className="card" style={{ color: 'var(--color-red-600)' }}>{error} <button className="btn-ghost" onClick={reload}>{t('common.retry')}</button></div>}

                {data && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="solar" icon={<Zap size={18} />} label={t('dash.powerNow')} value={`${num(reading?.powerW ?? 0)} W`}
                                subValue={t('dash.kwhToday', { kwh: num(reading?.energyTodayKwh ?? 0, 1) })} />
                            <StatCard variant="red" icon={<Thermometer size={18} />} label={t('dash.panelTemp')} value={reading?.panelTempC != null ? `${num(reading.panelTempC, 1)}°C` : '—'}
                                subValue={reading?.panelTempUncooledC != null ? t('dash.withoutCrops', { t: num(reading.panelTempUncooledC, 1) }) : ''} />
                            <StatCard variant="green" icon={<Compass size={18} />} label={t('solar.tilt')} value={`${data.current.tilt}° → ${data.optimal.tilt}°`}
                                subValue={t('solar.tiltGain', { g: data.optimal.potentialGain })} />
                            <StatCard variant="blue" icon={<Sun size={18} />} label={t('solar.expectedToday')} value={`${num(data.forecast7[0]?.kwh ?? data.current.dailyEnergy, 1)} kWh`}
                                subValue={data.peakSunHoursToday != null ? t('solar.psh', { h: data.peakSunHoursToday }) : ''} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="card">
                                <h2 style={h2}>{t('solar.sunChaser')}</h2>
                                <p style={sub}>{t('solar.sunChaserSub')}</p>
                                <TiltTool currentTilt={data.current.tilt} optimalTilt={data.optimal.tilt} sunAltitude={sunAlt}
                                    onSave={async (tilt) => { await update({ panelTilt: tilt }); reload(); history.reload(); }} />
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={h2}>{t('solar.todayCurve')}</h2>
                                <p style={sub}>{t('solar.todayCurveSub')}</p>
                                <div style={{ height: 240 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={hourly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                                            <YAxis yAxisId="kw" tick={{ fontSize: 10 }} />
                                            <YAxis yAxisId="t" orientation="right" tick={{ fontSize: 10 }} hide />
                                            <Tooltip formatter={(v, n) => (n === 'kw' ? [`${v} kW`, t('solar.power')] : [`${v}°C`, t('dash.panelTemp')])} />
                                            <Area yAxisId="kw" type="monotone" dataKey="kw" stroke="#d97706" fill="#fde68a" fillOpacity={0.6} />
                                            <Line yAxisId="t" type="monotone" dataKey="panelTempC" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-green-50)', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                                    <Leaf size={18} color="var(--color-green-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-700)', lineHeight: 1.55 }}>
                                        {t('solar.bioCoolingText', { d: data.bioCooling.temperatureReduction, g: data.bioCooling.efficiencyGain, shade: data.shadeCoverage })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <h2 style={h2}><CalendarDays size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('solar.forecast7')}</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                    {t('solar.weekTotal', { kwh: num(data.forecast7.reduce((s, f) => s + f.kwh, 0), 1), rs: num(data.forecast7.reduce((s, f) => s + f.revenue, 0)) })}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 md:grid-cols-7 gap-2" style={{ marginTop: '0.75rem' }}>
                                {data.forecast7.map((f, i) => (
                                    <div key={f.date} style={{ padding: '0.625rem 0.25rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: i === 0 ? 'var(--color-solar-50)' : 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)' }}>
                                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-gray-600)' }}>{i === 0 ? t('common.today') : date(f.date, { weekday: 'short' })}</div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9375rem', margin: '0.25rem 0' }}>{f.kwh}</div>
                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-500)' }}>kWh · ₹{num(f.revenue)}</div>
                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-solar-600)' }}>☀ {f.radiation}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <h2 style={h2}>{t('dash.energy30')}</h2>
                                {history.data && <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{num(history.data.summary.totalEnergy, 1)} kWh · ₹{num(history.data.summary.totalRevenue)}</span>}
                            </div>
                            <div style={{ height: 220, marginTop: '0.5rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hist} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v) => [`${v} kWh`, t('dash.energy')]} />
                                        <Bar dataKey="kwh" radius={[4, 4, 0, 0]}>
                                            {hist.map((d, i) => <Cell key={i} fill={d.partial ? '#fcd34d' : '#f59e0b'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{t('dash.energyMethod')}</div>
                        </div>

                        <Link href="/scan?mode=panel" className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                            <ScanLine size={22} color="var(--color-solar-600)" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>{t('solar.panelScan')}</div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)' }}>{t('solar.panelScanSub')}</div>
                            </div>
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
