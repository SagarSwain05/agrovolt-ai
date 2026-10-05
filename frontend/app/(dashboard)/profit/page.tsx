'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useI18n, cropKey } from '@/lib/i18n';
import { dashboardAPI } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { IndianRupee, Sun, Sprout, Leaf, Calculator, Loader2 } from 'lucide-react';

interface Profit {
    tariffPerKwh: number; capacityKW: number; solarInstalled: boolean; kwhPerKwDay: number; areaHa: number;
    monthly: { month: string; kwh: number; revenue: number; days: number; water: number }[];
    solar: { kwh: number; revenue: number; days: number };
    carbon: { earnedCredits: number; soldInr: number; unsoldValueInr: number };
    crops: { id: string; crop: string; season: string; status: string; harvest: string; yieldQuintal: number | null; yieldSource: string | null; pricePerQuintal: number | null; revenue: number | null }[];
}

export default function ProfitPage() {
    const { t, num, date } = useI18n();
    const { data, loading, error } = useApi<Profit>(() => dashboardAPI.profit(), []);
    const [extraKw, setExtraKw] = useState(0);
    const [tariff, setTariff] = useState<number | null>(null);

    const cropTotal = (data?.crops || []).reduce((s, c) => s + (c.revenue || 0), 0);
    const carbonTotal = (data?.carbon.soldInr || 0) + (data?.carbon.unsoldValueInr || 0);
    const total = (data?.solar.revenue || 0) + cropTotal + carbonTotal;

    const chart = useMemo(() => (data?.monthly || []).map((m) => ({
        label: date(m.month + '-01', { month: 'short', year: '2-digit' }), solar: m.revenue,
    })), [data, date]);

    const sim = useMemo(() => {
        if (!data) return null;
        const tr = tariff ?? data.tariffPerKwh;
        const kw = data.capacityKW + extraKw;
        const yearKwh = kw * data.kwhPerKwDay * 365;
        const baseYear = data.capacityKW * data.kwhPerKwDay * 365 * data.tariffPerKwh;
        const yearRs = yearKwh * tr;
        const co2t = (yearKwh * 0.82) / 1000;
        return { yearKwh, yearRs, delta: yearRs - baseYear, co2t, carbonRs: co2t * 1500, capex: extraKw * 45000 };
    }, [data, extraKw, tariff]);

    return (
        <div>
            <Navbar title={t('nav.profit')} subtitle={t('profit.subtitle')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {loading && !data && <div className="card" style={{ display: 'flex', gap: '0.5rem' }}><Loader2 size={16} className="animate-spin" /> {t('common.loading')}</div>}
                {error && !data && <div className="card" style={{ color: 'var(--color-red-600)' }}>{error}</div>}
                {data && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="green" icon={<IndianRupee size={18} />} label={t('profit.total')} value={`₹${num(total)}`} subValue={t('profit.totalSub')} />
                            <StatCard variant="solar" icon={<Sun size={18} />} label={t('profit.solar')} value={`₹${num(data.solar.revenue)}`} subValue={t('profit.solarSub', { kwh: num(data.solar.kwh), d: data.solar.days })} />
                            <StatCard variant="green" icon={<Sprout size={18} />} label={t('profit.crop')} value={cropTotal ? `₹${num(cropTotal)}` : '—'} subValue={t('profit.cropSub')} />
                            <StatCard variant="blue" icon={<Leaf size={18} />} label={t('profit.carbon')} value={`₹${num(carbonTotal)}`} subValue={t('profit.carbonSub', { sold: num(data.carbon.soldInr) })} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            <div className="card lg:col-span-3">
                                <h2 style={h2}>{t('profit.monthly')}</h2>
                                {chart.length ? (
                                    <div style={{ height: 240, marginTop: '0.5rem' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <Tooltip formatter={(v) => [`₹${v}`, t('profit.solar')]} />
                                                <Legend formatter={() => t('profit.solar')} />
                                                <Bar dataKey="solar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : <p style={sub}>{t('profit.noSolarData')} <Link href="/settings" style={{ color: 'var(--color-green-700)' }}>{t('dash.setupCta')}</Link></p>}
                            </div>

                            <div className="card lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                <h2 style={h2}><Calculator size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('profit.simTitle')}</h2>
                                <label className="label">{t('profit.simExtra', { kw: extraKw })}</label>
                                <input type="range" min={0} max={20} step={1} value={extraKw} onChange={(e) => setExtraKw(Number(e.target.value))} />
                                <label className="label">{t('profit.simTariff')}</label>
                                <input className="input" type="number" step={0.1} value={tariff ?? data.tariffPerKwh} onChange={(e) => setTariff(Number(e.target.value) || 0)} />
                                {sim && (
                                    <div style={{ fontSize: '0.8125rem', lineHeight: 1.7, color: 'var(--color-gray-700)' }}>
                                        <div>{t('profit.simYearKwh')}: <b>{num(sim.yearKwh)} kWh</b></div>
                                        <div>{t('profit.simYearRs')}: <b>₹{num(sim.yearRs)}</b> ({sim.delta >= 0 ? '+' : ''}₹{num(sim.delta)})</div>
                                        <div>{t('profit.simCarbon')}: <b>{num(sim.co2t, 2)} t</b> ≈ ₹{num(sim.carbonRs)}</div>
                                        {extraKw > 0 && <div>{t('profit.simCapex')}: ₹{num(sim.capex)} · {t('profit.simPayback', { y: num(sim.capex / Math.max(1, sim.delta + (extraKw * data.kwhPerKwDay * 365 * 0.82 / 1000) * 1500), 1) })}</div>}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{t('profit.simNote', { y: data.kwhPerKwDay })}</div>
                            </div>
                        </div>

                        <div className="card">
                            <h2 style={h2}>{t('profit.cropTable')}</h2>
                            <p style={sub}>{t('profit.cropTableSub')}</p>
                            {data.crops.length ? (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', minWidth: 520 }}>
                                        <thead><tr style={{ textAlign: 'left', color: 'var(--color-gray-500)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                            <th style={th}>{t('profit.colCrop')}</th><th style={th}>{t('profit.colHarvest')}</th><th style={th}>{t('profit.colYield')}</th><th style={th}>{t('profit.colPrice')}</th><th style={th}>{t('profit.colRevenue')}</th>
                                        </tr></thead>
                                        <tbody>
                                            {data.crops.map((c) => (
                                                <tr key={c.id} style={{ borderTop: '1px solid var(--color-gray-100)' }}>
                                                    <td style={td}><b>{t(cropKey(c.crop))}</b> <span style={{ color: 'var(--color-gray-500)' }}>· {t('season.' + c.season)}</span></td>
                                                    <td style={td}>{c.harvest ? date(c.harvest) : '—'}</td>
                                                    <td style={td}>{c.yieldQuintal != null ? `${num(c.yieldQuintal, 1)} q` : '—'}{c.yieldSource === 'district-average' && <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{t('profit.districtAvg')}</div>}</td>
                                                    <td style={td}>{c.pricePerQuintal ? `₹${num(c.pricePerQuintal)}` : '—'}</td>
                                                    <td style={{ ...td, fontWeight: 700 }}>{c.revenue ? `₹${num(c.revenue)}` : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p style={sub}>{t('profit.noCrops')} <Link href="/crops" style={{ color: 'var(--color-green-700)' }}>{t('nav.crops')} →</Link></p>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
const th: React.CSSProperties = { padding: '0.5rem' };
const td: React.CSSProperties = { padding: '0.5rem', verticalAlign: 'top' };
