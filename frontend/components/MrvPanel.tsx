'use client';

import React, { useState } from 'react';
import { mrvAPI, downloadFile, apiError } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { useI18n } from '@/lib/i18n';
import { FileCheck2, FileDown, Layers, Loader2 } from 'lucide-react';

interface Mrv { reportId: string; period: { from: string; to: string; days: number; meteredDays: number }; totals: { energyKwh: number; meteredKwh: number; co2AvoidedKg: number; credits: number; waterSavedL: number }; baseline: { gridEmissionFactorKgPerKwh: number; source: string }; methodology: Record<string, string>; datasetSha256: string }
interface Poa { scope: { state: string; district: string | null }; totals: { cpas: number; capacityKWp: number; energyKwh: number; credits: number; verifiableCredits: number }; notes: string[] }

export default function MrvPanel() {
    const { t, num } = useI18n();
    const mrv = useApi<Mrv>(() => mrvAPI.report(), []);
    const poa = useApi<Poa>(() => mrvAPI.poa(), []);
    const [busy, setBusy] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const dl = async (fmt: string, name: string) => {
        setBusy(fmt); setErr(null);
        try { await downloadFile(`/carbon/mrv?format=${fmt}`, name); } catch (e) { setErr(apiError(e)); } finally { setBusy(null); }
    };
    const btn: React.CSSProperties = { display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8125rem' };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
                <h2 style={h2}><FileCheck2 size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('mrv.title')}</h2>
                <p style={sub}>{t('mrv.sub')}</p>
                {mrv.loading && !mrv.data && <Loader2 size={16} className="animate-spin" />}
                {mrv.error && !mrv.data && <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>{mrv.error}</div>}
                {mrv.data && (
                    <>
                        <div style={{ fontSize: '0.8125rem', lineHeight: 1.8 }}>
                            <div>{t('mrv.period', { a: mrv.data.period.from, b: mrv.data.period.to, d: mrv.data.period.days, m: mrv.data.period.meteredDays })}</div>
                            <div>{t('mrv.totals', { kwh: num(mrv.data.totals.energyKwh, 1), co2: num(mrv.data.totals.co2AvoidedKg), c: mrv.data.totals.credits })}</div>
                            <div>{t('mrv.ef', { ef: mrv.data.baseline.gridEmissionFactorKgPerKwh })}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-gray-500)', wordBreak: 'break-all' }}>SHA-256 {mrv.data.datasetSha256}</div>
                        </div>
                        <details style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                            <summary style={{ cursor: 'pointer' }}>{t('mrv.formulas')}</summary>
                            {Object.entries(mrv.data.methodology).map(([k, v]) => <div key={k} style={{ margin: '0.25rem 0' }}><b>{k}</b>: {v}</div>)}
                        </details>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                            <button className="btn-primary" style={btn} disabled={!!busy} onClick={() => dl('pdf', `${mrv.data!.reportId}.pdf`)}>{busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} PDF</button>
                            <button className="btn-secondary" style={btn} disabled={!!busy} onClick={() => dl('csv', `${mrv.data!.reportId}.csv`)}>{busy === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {t('mrv.dailyCsv')}</button>
                            <button className="btn-secondary" style={btn} disabled={!!busy} onClick={() => dl('hourly-csv', `${mrv.data!.reportId}-hourly.csv`)}>{busy === 'hourly-csv' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} {t('mrv.hourlyCsv')}</button>
                        </div>
                        {err && <div style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>{err}</div>}
                    </>
                )}
            </div>
            <div className="card">
                <h2 style={h2}><Layers size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('poa.title')}</h2>
                <p style={sub}>{t('poa.sub')}</p>
                {poa.data && (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Box label={t('poa.cpas')} value={num(poa.data.totals.cpas)} />
                            <Box label={t('poa.capacity')} value={`${num(poa.data.totals.capacityKWp, 1)} kWp`} />
                            <Box label={t('poa.credits')} value={`${num(poa.data.totals.credits, 2)} t`} />
                            <Box label={t('poa.verifiable')} value={`${num(poa.data.totals.verifiableCredits, 2)} t`} />
                        </div>
                        <ul style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)', lineHeight: 1.6, margin: '0.625rem 0 0 1rem', listStyle: 'disc' }}>
                            <li>{t('poa.note1')}</li><li>{t('poa.note2')}</li><li>{t('poa.note3')}</li>
                        </ul>
                        <button className="btn-secondary" style={{ ...btn, marginTop: '0.625rem' }} onClick={() => downloadFile('/carbon/poa?format=csv', `agrovolt-poa-${poa.data!.scope.state}.csv`)}><FileDown size={14} /> {t('poa.csv')}</button>
                    </>
                )}
            </div>
        </div>
    );
}

function Box({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{value}</div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
