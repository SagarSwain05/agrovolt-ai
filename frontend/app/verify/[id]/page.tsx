'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { verifyAPI, apiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ShieldCheck, ShieldX, Loader2, Zap } from 'lucide-react';

interface Cert { certId: string; issuedTo: string; district: string; state: string; issuedAt: string; periodStart: string; periodEnd: string; solarKwh: number; waterSavedLiters: number; co2AvoidedKg: number; credits: number; verificationHash: string; methodology?: string }

export default function VerifyPage() {
    const { id } = useParams<{ id: string }>();
    const { t, num, date } = useI18n();
    const [c, setC] = useState<Cert | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        verifyAPI.certificate(id).then((r) => setC(r.data.data)).catch((e) => setErr(apiError(e)));
    }, [id]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div className="card" style={{ maxWidth: 520, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', color: 'var(--color-green-800)', fontWeight: 700 }}><Zap size={16} /> AgroVolt AI</Link>
                    <LanguageSwitcher />
                </div>
                {!c && !err && <div style={{ display: 'flex', gap: '0.5rem' }}><Loader2 className="animate-spin" size={16} /> {t('common.loading')}</div>}
                {err && <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--color-red-600)', alignItems: 'center' }}><ShieldX size={20} /> {t('verify.invalid')}</div>}
                {c && (
                    <>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--color-green-700)', fontWeight: 700, fontSize: '1.125rem' }}><ShieldCheck size={22} /> {t('verify.valid')}</div>
                        <div style={{ marginTop: '1rem', fontSize: '0.875rem', lineHeight: 1.9 }}>
                            <div>{t('carbon.certIssuedTo')}: <b>{c.issuedTo}</b> · {c.district}, {c.state}</div>
                            <div>{t('verify.issued')}: {date(c.issuedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            <div>{t('carbon.certPeriod')}: {date(c.periodStart)} – {date(c.periodEnd)}</div>
                            <div>{t('verify.solar')}: <b>{num(c.solarKwh, 1)} kWh</b></div>
                            <div>{t('carbon.co2Avoided')}: <b>{num(c.co2AvoidedKg)} kg</b> ({num(c.credits, 3)} tCO₂e)</div>
                            <div>{t('carbon.waterSaved')}: {num(c.waterSavedLiters)} L</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{c.certId} · #{c.verificationHash}</div>
                            {c.methodology && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{c.methodology}</div>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
