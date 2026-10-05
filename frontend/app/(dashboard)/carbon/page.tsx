'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useI18n } from '@/lib/i18n';
import { carbonAPI, apiError } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Leaf, Droplets, TreePine, IndianRupee, ShieldCheck, Award, Loader2, ExternalLink, Building2 } from 'lucide-react';

interface Wallet {
    wallet: { totalCredits: number; withdrawnCredits: number; availableCredits: number; monetaryValue: number };
    impact: { waterSaved: number; co2Reduced: number; treesEquivalent: number; carMilesOffset: number };
    marketInfo: { currentRate: number };
    insights: { accrualDays: number; monthlyAverage: number; projectedAnnual: number; projectedAnnualInr: number };
}
interface Intel {
    farmer_id: string;
    carbon_price_forecast: { current_price: number; forecast: { month: string; price: number }[]; recommendation: { action: string; reasoning: string; forecasted_price_q4: number } };
    ecological_metrics: { soil_organic_carbon_seq_kg: { value: number; co2e_kg: number }; methane_reduction_kg: { value: number; co2e_kg: number } };
    transaction_ledger: { transaction_id: string; date: string; type: string; description: string; credit_impact: string; monetary_estimate_inr: number; verification_status: string; verification_hash: string }[];
    live_esg_marketplace: { buyer_name: string; bid_price_per_credit: number; demand_level: string; min_credit_size: number; requirements: string[] }[];
}
interface Cert { certificate: { id: string; issuedTo: string; district: string; state: string; issuedDate: string; verificationHash: string; verificationUrl: string; period: { start: string; end: string; days: number } }; carbonSavings: { totalKgCo2: number; totalTonnesCo2: number }; environmentalImpact: { treesEquivalent: number } }

export default function CarbonPage() {
    const { t, num, date } = useI18n();
    const wallet = useApi<Wallet>(() => carbonAPI.getWallet(), [], 300000);
    const intel = useApi<Intel>(() => carbonAPI.getIntelligence(), []);
    const [sellMsg, setSellMsg] = useState<string | null>(null);
    const [selling, setSelling] = useState<string | null>(null);
    const [cert, setCert] = useState<Cert | null>(null);
    const [certBusy, setCertBusy] = useState(false);
    const [certErr, setCertErr] = useState<string | null>(null);

    const w = wallet.data;
    const avail = w?.wallet.availableCredits ?? 0;

    const sell = async (buyer: { buyer_name: string; bid_price_per_credit: number; min_credit_size: number }) => {
        setSellMsg(null);
        if (avail < buyer.min_credit_size) { setSellMsg(t('carbon.minSize', { n: buyer.min_credit_size })); return; }
        setSelling(buyer.buyer_name);
        try {
            const r = await carbonAPI.withdraw({ credits: avail, method: 'marketplace', buyerId: buyer.buyer_name });
            setSellMsg(t('carbon.sold', { n: num(avail, 3), buyer: buyer.buyer_name, rs: num(r.data.data.amount) }));
            wallet.reload(); intel.reload();
        } catch (e) { setSellMsg(apiError(e)); } finally { setSelling(null); }
    };

    const issueCert = async () => {
        setCertBusy(true); setCertErr(null);
        try { const r = await carbonAPI.certificate(); setCert(r.data.data); }
        catch (e) { setCertErr(apiError(e)); } finally { setCertBusy(false); }
    };

    const fc = intel.data?.carbon_price_forecast;

    return (
        <div>
            <Navbar title={t('nav.carbon')} subtitle={intel.data ? t('carbon.subtitle', { id: intel.data.farmer_id }) : t('common.loading')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {wallet.loading && !w && <div className="card" style={{ display: 'flex', gap: '0.5rem' }}><Loader2 size={16} className="animate-spin" /> {t('common.loading')}</div>}
                {w && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="green" icon={<Leaf size={18} />} label={t('carbon.available')} value={num(avail, 3)} subValue={`≈ ₹${num(w.wallet.monetaryValue)} @ ₹${num(w.marketInfo.currentRate)}`} />
                            <StatCard variant="default" icon={<ShieldCheck size={18} />} label={t('carbon.co2Avoided')} value={`${num(w.impact.co2Reduced)} kg`} subValue={t('carbon.trees', { n: num(w.impact.treesEquivalent) })} />
                            <StatCard variant="blue" icon={<Droplets size={18} />} label={t('carbon.waterSaved')} value={`${num(w.impact.waterSaved)} L`} subValue={t('dash.byPanelShade')} />
                            <StatCard variant="solar" icon={<IndianRupee size={18} />} label={t('carbon.projectedYear')} value={`₹${num(w.insights.projectedAnnualInr)}`}
                                subValue={t('carbon.projectedCredits', { n: num(w.insights.projectedAnnual, 2), d: w.insights.accrualDays })} />
                        </div>
                        {w.insights.accrualDays === 0 && <div className="card" style={{ background: 'var(--color-solar-50)', fontSize: '0.875rem' }}>{t('carbon.noAccrual')}</div>}
                    </>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Price forecast */}
                    <div className="card">
                        <h2 style={h2}>{t('carbon.priceForecast')}</h2>
                        {fc ? (
                            <>
                                <div style={{ height: 200, marginTop: '0.5rem' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={fc.forecast} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                                            <Tooltip formatter={(v) => [`₹${v}`, t('carbon.perCredit')]} />
                                            <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-green-50)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                                    <b>{t('carbon.action.' + fc.recommendation.action)}</b> — {t('carbon.q4', { rs: num(fc.recommendation.forecasted_price_q4) })}
                                </div>
                            </>
                        ) : <Loader2 size={16} className="animate-spin" />}
                    </div>

                    {/* Marketplace */}
                    <div className="card">
                        <h2 style={h2}><Building2 size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('carbon.marketplace')}</h2>
                        <p style={sub}>{t('carbon.marketplaceSub')}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(intel.data?.live_esg_marketplace || []).map((b) => (
                                <div key={b.buyer_name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{b.buyer_name}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{t('carbon.minCredits', { n: b.min_credit_size })} · {b.requirements.join(', ')}</div>
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green-700)' }}>₹{num(b.bid_price_per_credit)}</div>
                                    <button className="btn-primary" disabled={!avail || !!selling} onClick={() => sell(b)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                                        {selling === b.buyer_name ? <Loader2 size={13} className="animate-spin" /> : t('carbon.sell')}
                                    </button>
                                </div>
                            ))}
                        </div>
                        {sellMsg && <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: 'var(--color-green-700)' }}>{sellMsg}</div>}
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginTop: '0.5rem' }}>{t('carbon.marketplaceNote')}</div>
                    </div>
                </div>

                {/* Certificate */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <Award size={22} color="var(--color-solar-600)" />
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <h2 style={h2}>{t('carbon.certTitle')}</h2>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>{t('carbon.certSub')}</div>
                        </div>
                        <button className="btn-solar" onClick={issueCert} disabled={certBusy}>{certBusy ? t('common.loading') : t('carbon.certIssue')}</button>
                    </div>
                    {certErr && <div style={{ marginTop: '0.5rem', color: 'var(--color-red-600)', fontSize: '0.8125rem' }}>{certErr}</div>}
                    {cert && (
                        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--color-green-300)', background: 'var(--color-green-50)', fontSize: '0.8125rem', lineHeight: 1.7 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>{t('carbon.certHeading')}</div>
                            <div>{t('carbon.certIssuedTo')}: <b>{cert.certificate.issuedTo}</b> · {cert.certificate.district}, {cert.certificate.state}</div>
                            <div>{t('carbon.certPeriod')}: {date(cert.certificate.period.start)} – {date(cert.certificate.period.end)} ({cert.certificate.period.days} {t('common.days')})</div>
                            <div>{t('carbon.co2Avoided')}: <b>{num(cert.carbonSavings.totalKgCo2)} kg</b> ({num(cert.carbonSavings.totalTonnesCo2, 3)} tCO₂e)</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>ID {cert.certificate.id} · #{cert.certificate.verificationHash}</div>
                            <a href={cert.certificate.verificationUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-green-700)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                {t('carbon.certVerify')} <ExternalLink size={12} />
                            </a>
                        </div>
                    )}
                </div>

                {/* Ledger */}
                <div className="card">
                    <h2 style={h2}>{t('carbon.ledger')}</h2>
                    <p style={sub}>{t('carbon.ledgerSub')}</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', minWidth: 560 }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: 'var(--color-gray-500)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                    <th style={th}>{t('carbon.colDate')}</th><th style={th}>{t('carbon.colDesc')}</th><th style={th}>{t('carbon.colCredits')}</th><th style={th}>₹</th><th style={th}>{t('carbon.colStatus')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(intel.data?.transaction_ledger || []).map((x) => (
                                    <tr key={x.transaction_id} style={{ borderTop: '1px solid var(--color-gray-100)' }}>
                                        <td style={td}>{date(x.date)}</td>
                                        <td style={td}>{x.description}<div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>#{x.verification_hash}</div></td>
                                        <td style={{ ...td, fontFamily: 'var(--font-mono)', color: x.type === 'MINT' ? 'var(--color-green-700)' : 'var(--color-red-600)' }}>{x.credit_impact}</td>
                                        <td style={td}>{num(x.monetary_estimate_inr)}</td>
                                        <td style={td}><span className={`badge ${x.type === 'MINT' ? 'badge-green' : 'badge-blue'}`}>{t('carbon.status.' + x.verification_status)}</span></td>
                                    </tr>
                                ))}
                                {intel.data && !intel.data.transaction_ledger.length && (
                                    <tr><td colSpan={5} style={{ ...td, color: 'var(--color-gray-500)' }}>{t('common.none')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {intel.data && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <StatCard variant="green" icon={<TreePine size={18} />} label={t('carbon.soc')} value={`${num(intel.data.ecological_metrics.soil_organic_carbon_seq_kg.value)} kg C`}
                            subValue={`${num(intel.data.ecological_metrics.soil_organic_carbon_seq_kg.co2e_kg)} kg CO₂e · ${t('carbon.estimate')}`} />
                        <StatCard variant="blue" icon={<Droplets size={18} />} label={t('carbon.methane')} value={`${num(intel.data.ecological_metrics.methane_reduction_kg.value)} kg CH₄`}
                            subValue={`${num(intel.data.ecological_metrics.methane_reduction_kg.co2e_kg)} kg CO₂e · ${t('carbon.estimate')}`} />
                    </div>
                )}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
const th: React.CSSProperties = { padding: '0.5rem' };
const td: React.CSSProperties = { padding: '0.5rem', verticalAlign: 'top' };
