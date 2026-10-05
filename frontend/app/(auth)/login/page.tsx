'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import AuthShell from '@/components/AuthShell';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, waking } = useAuth();
    const { t } = useI18n();
    const router = useRouter();
    const expired = useSearchParams().get('expired');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err) {
            setError((err as Error).message || t('auth.loginFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title={t('auth.welcomeBack')} subtitle={t('auth.signInSub')}>
            {expired && !error && <div style={info}>{t('auth.expired')}</div>}
            {error && <div style={errBox}><AlertCircle size={16} /> {error}</div>}
            <form onSubmit={submit}>
                <div style={{ marginBottom: '1rem' }}>
                    <label className="label">{t('settings.email')}</label>
                    <input type="email" className="input" placeholder="farmer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                    <label className="label">{t('auth.password')}</label>
                    <input type="password" className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                    {loading ? <><Loader2 size={16} className="animate-spin" /> {t('auth.signingIn')}</> : <><LogIn size={16} /> {t('auth.signIn')}</>}
                </button>
                {waking && <div style={{ ...info, marginTop: '0.75rem', marginBottom: 0 }}>{t('common.waking')}</div>}
            </form>
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>
                {t('auth.noAccount')} <Link href="/register" style={{ color: 'var(--color-green-700)', fontWeight: 600 }}>{t('auth.register')}</Link>
            </p>
        </AuthShell>
    );
}

export default function LoginPage() {
    return <Suspense fallback={null}><LoginForm /></Suspense>;
}

const errBox: React.CSSProperties = { padding: '0.75rem', background: 'var(--color-red-50)', borderRadius: 'var(--radius-lg)', color: 'var(--color-red-600)', fontSize: '0.8125rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' };
const info: React.CSSProperties = { padding: '0.625rem 0.75rem', background: 'var(--color-solar-50)', borderRadius: 'var(--radius-lg)', color: 'var(--color-solar-700)', fontSize: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 };
