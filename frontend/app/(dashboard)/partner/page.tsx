'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { partnerAPI, apiError, API_BASE } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { Building2, Sun, AlertTriangle, Compass, WifiOff, KeyRound, Trash2, Copy, Send, Loader2, ShieldCheck } from 'lucide-react';

interface FleetFarm {
    farmId: string; farmCode: string; farmer: string; phone?: string; district: string; capacityKW: number; tilt: number; optimalTilt: number; tiltCompliant: boolean;
    kwh7: number; performanceRatio: number | null; dryDays: number | null; hardwareVerified: boolean; devices: number; lastDeviceAt: string | null; livePowerW: number | null; warnings: string[];
}
interface Fleet { partner: { name: string; code: string; role: string }; totals: { farms: number; capacityKW: number; kwh7: number; soiling: number; tiltIssues: number; offline: number }; farms: FleetFarm[] }
interface Key { _id: string; name: string; keyPrefix: string; webhookUrl?: string; usage?: { count: number; total: number }; lastUsedAt?: string; isActive: boolean }

const WARN = { soiling: 'var(--color-solar-600)', tilt: 'var(--color-blue-600)', underperforming: 'var(--color-red-600)', device_offline: 'var(--color-gray-600)' } as Record<string, string>;

export default function PartnerPage() {
    const { user } = useAuth();
    const { t, num, date } = useI18n();
    const fleet = useApi<Fleet>(() => partnerAPI.fleet(), [], 300000);
    const [keys, setKeys] = useState<Key[]>([]);
    const [newKey, setNewKey] = useState<{ apiKey: string; webhookSecret: string } | null>(null);
    const [keyName, setKeyName] = useState('');
    const [hooks, setHooks] = useState<Record<string, string>>({});
    const [msg, setMsg] = useState<string | null>(null);
    const loadKeys = () => partnerAPI.keys().then((r) => setKeys(r.data.data)).catch(() => { });
    useEffect(() => { loadKeys(); }, []);

    if (user && !['epc', 'fpo', 'admin'].includes(user.role)) {
        return <div><Navbar title={t('nav.partner')} /><div className="page-container"><div className="card">{t('partner.onlyPartners')}</div></div></div>;
    }
    const f = fleet.data;

    return (
        <div>
            <Navbar title={t('nav.partner')} subtitle={f ? `${f.partner.name} · ${f.partner.code}` : t('common.loading')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {fleet.loading && !f && <div className="card"><Loader2 className="animate-spin" size={16} /></div>}
                {f && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="green" icon={<Building2 size={18} />} label={t('fleet.farms')} value={num(f.totals.farms)} subValue={`${num(f.totals.capacityKW, 1)} kW`} />
                            <StatCard variant="solar" icon={<Sun size={18} />} label={t('fleet.kwh7')} value={`${num(f.totals.kwh7)} kWh`} />
                            <StatCard variant="red" icon={<AlertTriangle size={18} />} label={t('fleet.soiling')} value={num(f.totals.soiling)} subValue={t('fleet.tiltIssues', { n: f.totals.tiltIssues })} />
                            <StatCard variant="blue" icon={<WifiOff size={18} />} label={t('fleet.offline')} value={num(f.totals.offline)} />
                        </div>

                        <div className="card">
                            <h2 style={h2}>{t('fleet.title')}</h2>
                            <p style={sub}>{t('fleet.sub', { code: f.partner.code })}</p>
                            {f.farms.length === 0 ? <p style={sub}>{t('fleet.empty', { code: f.partner.code })}</p> : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse', minWidth: 760 }}>
                                        <thead><tr style={{ textAlign: 'left', color: 'var(--color-gray-500)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>
                                            <th style={th}>{t('fleet.colFarm')}</th><th style={th}>kW</th><th style={th}>{t('fleet.colKwh')}</th><th style={th}>PR</th><th style={th}>{t('fleet.colTilt')}</th><th style={th}>{t('fleet.colDry')}</th><th style={th}>{t('fleet.colDevice')}</th><th style={th}>{t('fleet.colWarn')}</th>
                                        </tr></thead>
                                        <tbody>
                                            {f.farms.map((r) => (
                                                <tr key={r.farmId} style={{ borderTop: '1px solid var(--color-gray-100)' }}>
                                                    <td style={td}><b>{r.farmCode}</b><div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{r.farmer} · {r.district}{r.phone ? ` · ${r.phone}` : ''}</div></td>
                                                    <td style={td}>{r.capacityKW}</td>
                                                    <td style={td}>{num(r.kwh7, 1)}</td>
                                                    <td style={td}>{r.performanceRatio ?? '—'}</td>
                                                    <td style={td}><Compass size={11} style={{ display: 'inline' }} /> {r.tilt}° / {r.optimalTilt}° {r.tiltCompliant ? '✓' : '⚠'}</td>
                                                    <td style={td}>{r.dryDays ?? '—'}</td>
                                                    <td style={td}>{r.hardwareVerified ? <span style={{ color: 'var(--color-green-700)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><ShieldCheck size={12} /> {r.livePowerW != null ? `${num(r.livePowerW)} W` : ''}</span> : t('fleet.virtual')}{r.lastDeviceAt && <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)' }}>{date(r.lastDeviceAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}</td>
                                                    <td style={td}>{r.warnings.length ? r.warnings.map((w) => <span key={w} className="badge" style={{ background: 'var(--color-gray-50)', color: WARN[w], marginRight: 4 }}>{t('fleet.w.' + w)}</span>) : <span style={{ color: 'var(--color-green-700)' }}>{t('fleet.ok')}</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="card">
                    <h2 style={h2}><KeyRound size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('api.title')}</h2>
                    <p style={sub}>{t('api.sub')}</p>
                    {keys.map((k) => (
                        <div key={k._id} style={{ padding: '0.625rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <b style={{ fontSize: '0.875rem' }}>{k.name}</b>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{k.keyPrefix}…</span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{t('api.usage', { n: k.usage?.count ?? 0, total: k.usage?.total ?? 0 })}</span>
                                <button className="btn-ghost" style={{ marginLeft: 'auto' }} aria-label={t('common.delete')} onClick={async () => { await partnerAPI.deleteKey(k._id); loadKeys(); }}><Trash2 size={14} /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                                <input className="input" style={{ flex: 1, minWidth: 220, fontSize: '0.8125rem' }} placeholder="https://your-app.example.com/agrovolt-webhook" value={hooks[k._id] ?? k.webhookUrl ?? ''} onChange={(e) => setHooks({ ...hooks, [k._id]: e.target.value })} />
                                <button className="btn-secondary" style={{ fontSize: '0.8125rem' }} onClick={async () => { try { await partnerAPI.updateKey(k._id, { webhookUrl: hooks[k._id] ?? k.webhookUrl ?? '' }); setMsg(t('common.saved')); loadKeys(); } catch (e) { setMsg(apiError(e)); } }}>{t('common.save')}</button>
                                <button className="btn-secondary" style={{ fontSize: '0.8125rem', display: 'inline-flex', gap: 4, alignItems: 'center' }} onClick={async () => { try { const r = await partnerAPI.testWebhook(k._id); setMsg(r.data.success ? t('api.hookOk') : t('api.hookFail')); } catch (e) { setMsg(apiError(e)); } }}><Send size={13} /> {t('api.testHook')}</button>
                            </div>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder={t('api.keyName')} value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                        <button className="btn-primary" onClick={async () => { const r = await partnerAPI.createKey(keyName || 'API key'); setNewKey(r.data.data); setKeyName(''); loadKeys(); }}>{t('api.create')}</button>
                    </div>
                    {msg && <div style={{ fontSize: '0.8125rem', color: 'var(--color-green-700)', marginTop: '0.375rem' }}>{msg}</div>}
                    {newKey && (
                        <div style={{ marginTop: '0.75rem', padding: '0.875rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-900)', color: '#e5e7eb', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                            <div style={{ color: '#fcd34d', fontWeight: 700, fontFamily: 'var(--font-body)', marginBottom: 6 }}>{t('settings.keyOnce')}</div>
                            <div>X-Api-Key: {newKey.apiKey} <button onClick={() => navigator.clipboard?.writeText(newKey.apiKey)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }} aria-label="copy"><Copy size={12} /></button></div>
                            <div>Webhook secret: {newKey.webhookSecret}</div>
                        </div>
                    )}
                    <details style={{ marginTop: '0.875rem' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>{t('api.docs')}</summary>
                        <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', background: 'var(--color-gray-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--color-gray-800)' }}>{`Base: ${API_BASE}/partner/v1   Header: X-Api-Key: avp_…

POST /crop-recommendation   {"lat":20.3,"lon":85.8,"soilType":"loamy","shadePct":40,"season":"kharif"}
POST /solar-estimate        {"lat":20.3,"lon":85.8,"capacityKW":10,"tilt":20,"crop":"turmeric","shadePct":35}
GET  /disease-risk?lat=20.3&lon=85.8&crops=tomato,rice
POST /crop-diagnostics      {"image":"data:image/jpeg;base64,…"}
POST /panel-diagnostics     {"image":"data:image/jpeg;base64,…"}

Webhooks (POST, JSON): events disease.detected · risk.alert · soiling.alert
Verify: X-AgroVolt-Signature = "sha256=" + HMAC_SHA256(webhookSecret, rawBody)`}</pre>
                    </details>
                </div>
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
const th: React.CSSProperties = { padding: '0.5rem' };
const td: React.CSSProperties = { padding: '0.5rem', verticalAlign: 'top' };
