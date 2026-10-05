'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n, LANGS } from '@/lib/i18n';
import AuthShell from '@/components/AuthShell';
import type { Lang } from '@/lib/api';
import { UserPlus, Loader2, AlertCircle, Crosshair, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
    const { register, waking } = useAuth();
    const { t, lang, setLang } = useI18n();
    const router = useRouter();
    const [f, setF] = useState({ name: '', email: '', phone: '', password: '', district: '', state: 'Odisha', farmSize: '2' });
    const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
    const [gpsMsg, setGpsMsg] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

    const useGps = () => {
        if (!navigator.geolocation) return setGpsMsg(t('settings.noGps'));
        setGpsMsg(t('common.loading'));
        navigator.geolocation.getCurrentPosition(
            (p) => { setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setGpsMsg(''); },
            () => setGpsMsg(t('settings.gpsDenied')),
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register({ ...f, farmSize: parseFloat(f.farmSize) || 2, language: lang, ...(gps || {}) });
            router.push('/settings?welcome=1');
        } catch (err) {
            setError((err as Error).message || t('auth.registerFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title={t('auth.createAccount')} subtitle={t('auth.createSub')} wide>
            {error && <div style={errBox}><AlertCircle size={16} /> {error}</div>}
            <form onSubmit={submit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="label">{t('settings.name')}</label><input className="input" value={f.name} onChange={set('name')} required /></div>
                    <div><label className="label">{t('settings.phone')}</label><input className="input" type="tel" value={f.phone} onChange={set('phone')} placeholder="+91" /></div>
                    <div><label className="label">{t('settings.email')}</label><input className="input" type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></div>
                    <div><label className="label">{t('auth.password')}</label><input className="input" type="password" value={f.password} onChange={set('password')} required minLength={6} autoComplete="new-password" /></div>
                    <div><label className="label">{t('settings.district')}</label><input className="input" value={f.district} onChange={set('district')} placeholder="Khordha" required /></div>
                    <div><label className="label">{t('settings.state')}</label><input className="input" value={f.state} onChange={set('state')} /></div>
                    <div><label className="label">{t('settings.farmSize')}</label><input className="input" type="number" step="0.1" min="0.1" value={f.farmSize} onChange={set('farmSize')} /></div>
                    <div>
                        <label className="label">{t('auth.preferredLang')}</label>
                        <select className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                    </div>
                </div>
                <button type="button" onClick={useGps} className="btn-secondary" style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
                    {gps ? <CheckCircle2 size={14} color="var(--color-green-600)" /> : <Crosshair size={14} />} {gps ? t('auth.gpsSet', { lat: gps.latitude.toFixed(3), lon: gps.longitude.toFixed(3) }) : t('auth.useGps')}
                </button>
                {gpsMsg && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '0.25rem' }}>{gpsMsg}</div>}
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', marginTop: '0.375rem' }}>{t('auth.locationNote')}</div>
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                    {loading ? <><Loader2 size={16} className="animate-spin" /> {t('auth.creating')}</> : <><UserPlus size={16} /> {t('auth.createAccount')}</>}
                </button>
                {waking && <div style={{ padding: '0.625rem', background: 'var(--color-solar-50)', borderRadius: 'var(--radius-lg)', color: 'var(--color-solar-700)', fontSize: '0.75rem', marginTop: '0.75rem' }}>{t('common.waking')}</div>}
            </form>
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>
                {t('auth.haveAccount')} <Link href="/login" style={{ color: 'var(--color-green-700)', fontWeight: 600 }}>{t('auth.signIn')}</Link>
            </p>
        </AuthShell>
    );
}

const errBox: React.CSSProperties = { padding: '0.75rem', background: 'var(--color-red-50)', borderRadius: 'var(--radius-lg)', color: 'var(--color-red-600)', fontSize: '0.8125rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' };
