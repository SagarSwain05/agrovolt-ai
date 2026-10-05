'use client';

import React, { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import PriceReportForm from '@/components/PriceReportForm';
import { useI18n, cropKey } from '@/lib/i18n';
import { marketAPI } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Minus, MapPin, Truck, Timer, CalendarClock, Loader2, Database } from 'lucide-react';

const CROPS = ['Tomato', 'Turmeric', 'Rice', 'Wheat', 'Millet', 'Groundnut', 'Soybean'];

interface Prices {
    crop: string; source: 'live' | 'snapshot' | 'crowd'; sourceLabel: string; fetchedAt: string | null;
    feedStatus?: { lastSuccess: string | null; lastError: { at: string; message: string } | null };
    prices: { mandi: string; district: string; distance_km: number | null; price: number; transportCost: number | null; netProfit: number; trend: string; demand: string; lastUpdated: string; source?: string; reports?: number; verified?: boolean }[];
    analysis: { avgPrice: number; bestPrice: number; bestMandi: string; bestNetProfit: number; transportCostRate: number };
}
interface Trends {
    history: { date: string; price: number }[];
    forecast: { date: string; price: number; lower: number; upper: number; event?: { name: string } | null }[];
    signal: 'SELL' | 'WAIT' | 'HOLD'; confidence: number; pctChange: number; isLive: boolean; asOf: string; dataSource: string;
    upcomingEvents: { name?: string; event?: string; date?: string; start_date?: string; impact?: string; expected_impact_pct?: number }[];
}
interface Rec {
    current: { price: number; revenue: number }; projected: { price: number; revenue: number; gain: number };
    recommendation: { action: string; waitDays: number; confidence: string }; msp: number | null;
}

export default function MarketPage() {
    const { t, num, date } = useI18n();
    const [crop, setCrop] = useState('Tomato');
    const [qty, setQty] = useState(10);
    const prices = useApi<Prices>(() => marketAPI.getPrices(crop), [crop], 600000);
    const trends = useApi<Trends>(() => marketAPI.getTrends(crop), [crop]);
    const rec = useApi<Rec>(() => marketAPI.getRecommendation(crop, qty), [crop, qty]);

    const chart = useMemo(() => {
        if (!trends.data) return [];
        const h = trends.data.history.slice(-30).map((d) => ({ label: date(d.date), actual: d.price }));
        const last = trends.data.history[trends.data.history.length - 1];
        const f = trends.data.forecast.map((d) => ({ label: date(d.date), forecast: d.price, band: [d.lower, d.upper] as [number, number] }));
        if (last && f.length) f.unshift({ label: date(last.date), forecast: last.price, band: [last.price, last.price] });
        return [...h.slice(0, -1), { ...h[h.length - 1], ...(f[0] || {}) }, ...f.slice(1)];
    }, [trends.data, date]);

    const signal = trends.data?.signal;
    const SigIcon = signal === 'SELL' ? TrendingDown : signal === 'WAIT' ? TrendingUp : Minus;
    const cropName = t(cropKey(crop));

    return (
        <div>
            <Navbar title={t('nav.market')} subtitle={prices.data ? prices.data.sourceLabel : t('common.loading')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="scrollbar-hide" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                    {CROPS.map((c) => (
                        <button key={c} onClick={() => setCrop(c)} style={{
                            flexShrink: 0, padding: '0.45rem 1rem', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                            border: c === crop ? '1px solid var(--color-green-600)' : '1px solid var(--color-gray-200)',
                            background: c === crop ? 'var(--color-green-600)' : 'white', color: c === crop ? 'white' : 'var(--color-gray-700)',
                        }}>{t(cropKey(c))}</button>
                    ))}
                </div>

                {prices.data && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-gray-600)', flexWrap: 'wrap' }}>
                        <span className={`badge ${prices.data.source === 'live' ? 'badge-green' : prices.data.source === 'crowd' ? 'badge-blue' : 'badge-solar'}`} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                            <Database size={11} /> {t('market.src.' + prices.data.source)}
                        </span>
                        {prices.data.source !== 'live' && trends.data && <span>{t('market.snapshotNote', { d: date(trends.data.asOf, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>}
                        {prices.data.source !== 'live' && prices.data.feedStatus?.lastError && <span style={{ color: 'var(--color-gray-400)' }}>· {t('market.retrying')}</span>}
                    </div>
                )}

                {(prices.loading && !prices.data) && <div className="card" style={{ display: 'flex', gap: '0.5rem' }}><Loader2 size={16} className="animate-spin" /> {t('common.loading')}</div>}

                {prices.data && trends.data && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard variant="green" icon={<TrendingUp size={18} />} label={t('market.avgPrice', { crop: cropName })} value={`₹${num(prices.data.analysis.avgPrice)}`} subValue={t('common.perQuintal')} />
                        <StatCard variant="solar" icon={<MapPin size={18} />} label={t('market.bestNet')} value={`₹${num(prices.data.analysis.bestNetProfit)}`} subValue={prices.data.analysis.bestMandi} />
                        <StatCard variant={trends.data.pctChange >= 0 ? 'green' : 'red'} icon={<SigIcon size={18} />} label={t('market.forecast7')}
                            value={`${trends.data.pctChange >= 0 ? '+' : ''}${trends.data.pctChange}%`} subValue={t('market.confidence', { c: trends.data.confidence })} />
                        <StatCard variant="blue" icon={<Timer size={18} />} label={t('market.signal')} value={t('market.sig.' + (signal || 'HOLD'))}
                            subValue={rec.data && rec.data.recommendation.waitDays ? t('market.waitDays', { d: rec.data.recommendation.waitDays }) : ''} />
                    </div>
                )}

                {trends.data && (
                    <div className="card">
                        <h2 style={h2}>{t('market.chartTitle', { crop: cropName })}</h2>
                        <p style={sub}>{t('market.chartSub')}</p>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chart} margin={{ top: 5, right: 8, left: -5, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                                    <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                                    <Tooltip formatter={(v, n) => (Array.isArray(v) ? [`₹${v[0]}–₹${v[1]}`, t('market.band')] : [`₹${v}`, n === 'actual' ? t('market.actual') : t('market.forecast')])} />
                                    <Area dataKey="band" stroke="none" fill="#a7f3d0" fillOpacity={0.5} />
                                    <Line dataKey="actual" stroke="#047857" strokeWidth={2} dot={false} />
                                    <Line dataKey="forecast" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                                    {rec.data?.msp && <ReferenceLine y={rec.data.msp} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'MSP', fontSize: 10, fill: '#ef4444' }} />}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{t('market.model')} · {trends.data.dataSource}</div>
                    </div>
                )}

                <PriceReportForm crop={crop} mandis={(prices.data?.prices || []).map((p) => p.mandi)} onDone={() => prices.reload()} />

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {prices.data && (
                        <div className="card lg:col-span-3">
                            <h2 style={h2}><Truck size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('market.mandiTitle')}</h2>
                            <p style={sub}>{t('market.mandiSub', { rate: prices.data.analysis.transportCostRate })}</p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', minWidth: 480 }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--color-gray-500)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                            <th style={th}>{t('market.colMandi')}</th><th style={th}>{t('market.colDist')}</th><th style={th}>{t('market.colPrice')}</th><th style={th}>{t('market.colTransport')}</th><th style={th}>{t('market.colNet')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {prices.data.prices.map((p, i) => (
                                            <tr key={p.mandi} style={{ borderTop: '1px solid var(--color-gray-100)', background: i === 0 ? 'var(--color-green-50)' : undefined }}>
                                                <td style={td}><b>{p.mandi}</b><div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{p.district}{p.source === 'crowd' && <> · <span style={{ color: 'var(--color-blue-600)' }}>{t('market.crowdRow', { n: p.reports })}{p.verified ? ' ✓FPO' : ''}</span></>}{p.source === 'snapshot' && <> · {t('market.snapRow')}</>}</div></td>
                                                <td style={td}>{p.distance_km != null ? `${p.distance_km} km` : '—'}</td>
                                                <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>₹{num(p.price)}</td>
                                                <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--color-red-600)' }}>{p.transportCost != null ? `−₹${num(p.transportCost)}` : '—'}</td>
                                                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green-700)' }}>₹{num(p.netProfit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="card lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h2 style={h2}><Timer size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('market.sellTimer')}</h2>
                        <label className="label">{t('market.qty')}</label>
                        <input className="input" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                        {rec.data && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div style={box}><div style={boxLabel}>{t('market.sellNow')}</div><div style={boxVal}>₹{num(rec.data.current.revenue)}</div></div>
                                    <div style={box}><div style={boxLabel}>{t('market.afterDays', { d: rec.data.recommendation.waitDays || 7 })}</div><div style={boxVal}>₹{num(rec.data.projected.revenue)}</div></div>
                                </div>
                                <div style={{
                                    padding: '0.75rem', borderRadius: 'var(--radius-lg)', fontSize: '0.875rem', lineHeight: 1.5,
                                    background: signal === 'SELL' ? 'var(--color-red-50)' : signal === 'WAIT' ? 'var(--color-green-50)' : 'var(--color-gray-50)',
                                }}>
                                    {signal === 'SELL' ? t('market.adviceSell', { crop: cropName })
                                        : signal === 'WAIT' ? t('market.adviceWait', { crop: cropName, d: rec.data.recommendation.waitDays, rs: num(rec.data.projected.gain) })
                                            : t('market.adviceHold', { crop: cropName })}
                                </div>
                            </>
                        )}
                        {!!trends.data?.upcomingEvents?.length && (
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gray-600)', marginBottom: '0.375rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                    <CalendarClock size={13} /> {t('market.events')}
                                </div>
                                {trends.data.upcomingEvents.map((e, i) => (
                                    <div key={i} style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)', padding: '0.25rem 0' }}>
                                        • {e.name || e.event}{(e.date || e.start_date) ? ` — ${date(String(e.date || e.start_date))}` : ''}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
const th: React.CSSProperties = { padding: '0.5rem' };
const td: React.CSSProperties = { padding: '0.5rem', verticalAlign: 'top' };
const box: React.CSSProperties = { padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)' };
const boxLabel: React.CSSProperties = { fontSize: '0.6875rem', color: 'var(--color-gray-500)' };
const boxVal: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.0625rem' };
