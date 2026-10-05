'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useI18n } from '@/lib/i18n';
import { schemeAPI, apiError } from '@/lib/api';
import { Landmark, CheckCircle2, XCircle, HelpCircle, ExternalLink, FileText, Loader2, Clock } from 'lucide-react';

interface Scheme {
    id: string; name: string; fullName: string; ministry: string; description: string; subsidyPct: number; maxAmount: number; deadline: string;
    documents: string[]; url: string; status: 'eligible' | 'not_eligible' | 'needs_info' | 'closed';
    criteria: { key: string; met: boolean | null; params: Record<string, string | number> }[];
}

const STATUS = {
    eligible: { color: 'var(--color-green-700)', bg: 'var(--color-green-50)' },
    needs_info: { color: 'var(--color-solar-700)', bg: 'var(--color-solar-50)' },
    not_eligible: { color: 'var(--color-red-600)', bg: 'var(--color-red-50)' },
    closed: { color: 'var(--color-gray-600)', bg: 'var(--color-gray-100)' },
};

type YN = '' | 'yes' | 'no';

export default function SubsidiesPage() {
    const { t, num, date } = useI18n();
    const [a, setA] = useState<{ hasDieselPump: YN; hasGridPump: YN; pumpHp: string; category: string; availedBefore: YN; fallowAcres: string; discomAgreement: YN; dataSharing: YN }>({
        hasDieselPump: '', hasGridPump: '', pumpHp: '', category: '', availedBefore: '', fallowAcres: '', discomAgreement: '', dataSharing: '',
    });
    const [res, setRes] = useState<Scheme[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const check = async () => {
        setBusy(true); setErr(null);
        try { const r = await schemeAPI.check(a); setRes(r.data.data.schemes); } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { check(); }, []);

    const yn = (k: keyof typeof a, label: string) => (
        <div>
            <label className="label">{label}</label>
            <select className="select" value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })}>
                <option value="">{t('subsidy.notSure')}</option>
                <option value="yes">{t('common.yes')}</option>
                <option value="no">{t('common.no')}</option>
            </select>
        </div>
    );

    return (
        <div>
            <Navbar title={t('nav.subsidies')} subtitle={t('subsidy.subtitle')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="card">
                    <h2 style={h2}>{t('subsidy.questions')}</h2>
                    <p style={sub}>{t('subsidy.questionsSub')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {yn('hasDieselPump', t('subsidy.q.diesel'))}
                        {yn('hasGridPump', t('subsidy.q.grid'))}
                        <div><label className="label">{t('subsidy.q.hp')}</label><input className="input" type="number" value={a.pumpHp} onChange={(e) => setA({ ...a, pumpHp: e.target.value })} /></div>
                        <div>
                            <label className="label">{t('subsidy.q.category')}</label>
                            <select className="select" value={a.category} onChange={(e) => setA({ ...a, category: e.target.value })}>
                                <option value="">{t('subsidy.notSure')}</option>
                                <option value="marginal">{t('subsidy.cat.marginal')}</option>
                                <option value="small">{t('subsidy.cat.small')}</option>
                                <option value="scst">{t('subsidy.cat.scst')}</option>
                                <option value="other">{t('subsidy.cat.other')}</option>
                            </select>
                        </div>
                        {yn('availedBefore', t('subsidy.q.availed'))}
                        <div><label className="label">{t('subsidy.q.fallow')}</label><input className="input" type="number" value={a.fallowAcres} onChange={(e) => setA({ ...a, fallowAcres: e.target.value })} /></div>
                        {yn('discomAgreement', t('subsidy.q.discom'))}
                        {yn('dataSharing', t('subsidy.q.data'))}
                    </div>
                    <button className="btn-primary" style={{ marginTop: '0.875rem' }} onClick={check} disabled={busy}>{busy ? t('common.loading') : t('subsidy.check')}</button>
                    {err && <div style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{err}</div>}
                </div>

                {!res && busy && <Loader2 className="animate-spin" size={18} />}
                {res?.map((s) => {
                    const st = STATUS[s.status];
                    return (
                        <div key={s.id} className="card">
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <Landmark size={22} color="var(--color-green-700)" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{s.ministry}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-700)', marginTop: '0.375rem', lineHeight: 1.5 }}>{t('scheme.' + s.id, {}) !== 'scheme.' + s.id ? t('scheme.' + s.id) : s.description}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className="badge" style={{ background: st.bg, color: st.color }}>{t('subsidy.status.' + s.status)}</span>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '0.375rem' }}>{s.subsidyPct}% · {t('subsidy.upTo')} ₹{num(s.maxAmount)}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={11} /> {t('subsidy.deadline')} {date(s.deadline, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1" style={{ marginTop: '0.75rem' }}>
                                {s.criteria.map((c) => (
                                    <div key={c.key} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                                        {c.met === true ? <CheckCircle2 size={14} color="var(--color-green-600)" /> : c.met === false ? <XCircle size={14} color="var(--color-red-500)" /> : <HelpCircle size={14} color="var(--color-solar-500)" />}
                                        {t('crit.' + c.key, c.params)}
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                    <FileText size={13} /> {s.documents.join(' · ')}
                                </div>
                                {s.status !== 'closed' && (
                                    <a href={s.url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ marginLeft: 'auto', textDecoration: 'none', display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                                        {t('subsidy.apply')} <ExternalLink size={13} />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
