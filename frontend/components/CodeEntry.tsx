'use client';

import React, { useEffect, useState } from 'react';
import { authAPI, apiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { MailCheck, Loader2, AlertCircle } from 'lucide-react';

/** Enter the 6-digit code emailed by AgroVolt (verification or password reset). */
export default function CodeEntry({ email, purpose, onSubmit, onBack }: {
    email: string;
    purpose: 'verify' | 'reset';
    onSubmit: (code: string, newPassword?: string) => Promise<void>;
    onBack?: () => void;
}) {
    const { t } = useI18n();
    const [code, setCode] = useState('');
    const [pw, setPw] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [cool, setCool] = useState(45);
    useEffect(() => { const id = setInterval(() => setCool((c) => Math.max(0, c - 1)), 1000); return () => clearInterval(id); }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setErr(null);
        try { await onSubmit(code, purpose === 'reset' ? pw : undefined); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    };
    const resend = async () => {
        setErr(null);
        try {
            if (purpose === 'verify') await authAPI.resendCode(email); else await authAPI.forgotPassword(email);
            setInfo(t('otp.resent')); setCool(45);
        } catch (x) { setErr(apiError(x)); }
    };

    return (
        <form onSubmit={submit}>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', padding: '0.75rem', background: 'var(--color-green-50)', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }}>
                <MailCheck size={20} color="var(--color-green-700)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>{t(purpose === 'verify' ? 'otp.sentVerify' : 'otp.sentReset', { email })}</div>
            </div>
            {err && <div style={{ padding: '0.625rem', background: 'var(--color-red-50)', color: 'var(--color-red-600)', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><AlertCircle size={15} /> {err}</div>}
            <label className="label">{t('otp.code')}</label>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus
                style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', letterSpacing: '0.5em', textAlign: 'center' }} />
            {purpose === 'reset' && (
                <div style={{ marginTop: '0.75rem' }}>
                    <label className="label">{t('otp.newPassword')}</label>
                    <input className="input" type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" />
                </div>
            )}
            <button className="btn-primary" type="submit" disabled={busy || code.length !== 6} style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.4rem', alignItems: 'center' }}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} {purpose === 'verify' ? t('otp.verify') : t('otp.reset')}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
                {onBack ? <button type="button" onClick={onBack} style={linkBtn}>← {t('otp.back')}</button> : <span />}
                <button type="button" onClick={resend} disabled={cool > 0} style={{ ...linkBtn, opacity: cool > 0 ? 0.5 : 1 }}>{cool > 0 ? t('otp.resendIn', { s: cool }) : t('otp.resend')}</button>
            </div>
            {info && <div style={{ fontSize: '0.75rem', color: 'var(--color-green-700)', marginTop: '0.375rem', textAlign: 'right' }}>{info}</div>}
        </form>
    );
}

const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--color-green-700)', cursor: 'pointer', fontWeight: 600, padding: 0 };
