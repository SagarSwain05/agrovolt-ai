'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { useI18n, cropKey } from '@/lib/i18n';
import { reportAPI } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { speak } from '@/lib/speech';
import { FileText, CloudRain, Thermometer, Sun, Droplets, AlertTriangle, Sprout, Zap, Printer, Volume2, Loader2, Bug } from 'lucide-react';

interface Report {
    generatedAt: string; season: string;
    farm: { name: string; district: string; state: string; soil: string; sizeAcres: number };
    climate: { periodDays: number; rainfallMm: number; et0Mm: number; avgTmax: number; maxTmax: number; heatDays: number; longestDrySpell: number; avgSunKwhM2: number; next7: { rainMm: number; tmax: number }; source: string };
    risks: { code: string; level: 'high' | 'medium'; value: number }[];
    crops: { name: string; confidence: number; market: { price: number; pctChange: number; signal: string; asOf: string } | null }[];
    solar: { days: number; kwh: number; revenue: number; waterSavedL: number; co2Kg: number } | null;
    diseases: { name: string; count: number }[];
}

export default function ReportsPage() {
    const { t, num, date, lang } = useI18n();
    const { data: r, loading, error, reload } = useApi<Report>(() => reportAPI.season(), []);

    const summary = () => {
        if (!r) return '';
        const parts = [
            t('report.speakClimate', { d: r.climate.periodDays, rain: r.climate.rainfallMm, t: r.climate.avgTmax }),
            r.crops[0] ? t('report.speakCrop', { crop: t(cropKey(r.crops[0].name)), c: r.crops[0].confidence }) : '',
            ...r.risks.map((x) => t('risk.' + x.code, { v: x.value })),
        ];
        return parts.filter(Boolean).join(' ');
    };

    return (
        <div>
            <Navbar title={t('nav.reports')} subtitle={t('report.subtitle')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {loading && !r && <div className="card" style={{ display: 'flex', gap: '0.5rem' }}><Loader2 size={16} className="animate-spin" /> {t('report.building')}</div>}
                {error && !r && <div className="card" style={{ color: 'var(--color-red-600)' }}>{error} <button className="btn-ghost" onClick={reload}>{t('common.retry')}</button></div>}
                {r && (
                    <>
                        <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-2xl)', background: 'linear-gradient(135deg, var(--color-green-800), var(--color-green-900))', color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75 }}>
                                <FileText size={16} /> {t('report.kicker')}
                            </div>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, margin: '0.375rem 0' }}>
                                {t('report.title', { season: t('season.' + r.season), y: new Date(r.generatedAt).getFullYear() })}
                            </h2>
                            <p style={{ fontSize: '0.8125rem', opacity: 0.8 }}>
                                {t('report.generated', { d: date(r.generatedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })} · {r.farm.name} · {r.farm.district}, {r.farm.state} · {t('soil.' + r.farm.soil)}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }} className="no-print">
                                <button onClick={() => speak(summary(), lang)} style={hdrBtn}><Volume2 size={14} /> {t('dash.listen')}</button>
                                <button onClick={() => window.print()} style={hdrBtn}><Printer size={14} /> {t('common.print')}</button>
                            </div>
                        </div>

                        <div className="card">
                            <h3 style={h3}><CloudRain size={18} color="var(--color-blue-500)" /> {t('report.climate', { d: r.climate.periodDays })}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <Tile icon={<Droplets size={16} />} label={t('report.rain')} value={`${num(r.climate.rainfallMm)} mm`} hint={t('report.et0', { v: num(r.climate.et0Mm) })} />
                                <Tile icon={<Thermometer size={16} />} label={t('report.avgTmax')} value={`${r.climate.avgTmax}°C`} hint={t('report.peak', { v: r.climate.maxTmax })} />
                                <Tile icon={<AlertTriangle size={16} />} label={t('report.heatDays')} value={String(r.climate.heatDays)} hint="≥ 38°C" />
                                <Tile icon={<Sun size={16} />} label={t('report.sun')} value={`${r.climate.avgSunKwhM2} kWh/m²`} hint={t('report.perDay')} />
                                <Tile icon={<CloudRain size={16} />} label={t('report.drySpell')} value={`${r.climate.longestDrySpell} ${t('common.days')}`} />
                                <Tile icon={<CloudRain size={16} />} label={t('report.next7')} value={`${r.climate.next7.rainMm} mm`} hint={t('report.peak', { v: r.climate.next7.tmax })} />
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginTop: '0.5rem' }}>{r.climate.source}</div>
                        </div>

                        <div className="card">
                            <h3 style={h3}><AlertTriangle size={18} color="var(--color-solar-600)" /> {t('report.risks')}</h3>
                            {r.risks.length === 0 ? <p style={{ ...sub, color: 'var(--color-green-700)' }}>{t('report.noRisks')}</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    {r.risks.map((x) => (
                                        <div key={x.code} style={{ padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: x.level === 'high' ? 'var(--color-red-50)' : 'var(--color-solar-50)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                                            <b>{t('risk.level.' + x.level)}:</b> {t('risk.' + x.code, { v: x.value })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h3 style={h3}><Sprout size={18} color="var(--color-green-600)" /> {t('report.crops', { season: t('season.' + r.season) })}</h3>
                            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                                <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', minWidth: 460 }}>
                                    <thead><tr style={{ textAlign: 'left', color: 'var(--color-gray-500)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                        <th style={th}>{t('profit.colCrop')}</th><th style={th}>{t('report.suitability')}</th><th style={th}>{t('profit.colPrice')}</th><th style={th}>{t('market.forecast7')}</th>
                                    </tr></thead>
                                    <tbody>
                                        {r.crops.map((c) => (
                                            <tr key={c.name} style={{ borderTop: '1px solid var(--color-gray-100)' }}>
                                                <td style={td}><b>{t(cropKey(c.name))}</b></td>
                                                <td style={td}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--color-gray-100)' }}><div style={{ width: `${c.confidence}%`, height: '100%', borderRadius: 3, background: 'var(--color-green-500)' }} /></div>
                                                        {c.confidence}%
                                                    </div>
                                                </td>
                                                <td style={td}>{c.market ? `₹${num(c.market.price)}` : '—'}</td>
                                                <td style={td}>{c.market ? `${c.market.pctChange >= 0 ? '+' : ''}${c.market.pctChange}% · ${t('market.sig.' + c.market.signal)}` : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="card">
                                <h3 style={h3}><Zap size={18} color="var(--color-solar-600)" /> {t('report.solar')}</h3>
                                {r.solar ? (
                                    <div style={{ fontSize: '0.875rem', lineHeight: 1.8, marginTop: '0.5rem' }}>
                                        <div>{t('report.solarLine', { kwh: num(r.solar.kwh), d: r.solar.days, rs: num(r.solar.revenue) })}</div>
                                        <div>{t('report.solarEnv', { w: num(r.solar.waterSavedL), c: num(r.solar.co2Kg) })}</div>
                                    </div>
                                ) : <p style={sub}>{t('dash.setupBody')}</p>}
                            </div>
                            <div className="card">
                                <h3 style={h3}><Bug size={18} color="var(--color-red-500)" /> {t('report.disease')}</h3>
                                {r.diseases.length ? r.diseases.map((d) => <div key={d.name} style={{ fontSize: '0.875rem', marginTop: '0.375rem' }}>• {d.name} × {d.count}</div>)
                                    : <p style={sub}>{t('report.noDisease')}</p>}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <style>{`@media print { .no-print, aside, nav, .sahayak-fab, header { display: none !important; } main { margin: 0 !important; } }`}</style>
        </div>
    );
}

function Tile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
    return (
        <div style={{ padding: '0.875rem', borderRadius: 'var(--radius-xl)', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{icon} {label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.125rem', marginTop: '0.25rem' }}>{value}</div>
            {hint && <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>{hint}</div>}
        </div>
    );
}

const h3: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.5rem 0 0' };
const th: React.CSSProperties = { padding: '0.5rem' };
const td: React.CSSProperties = { padding: '0.5rem' };
const hdrBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontSize: '0.8125rem' };
