'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { wakeBackend } from '@/lib/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Zap, Sprout, Sun, Mic, TrendingUp, Leaf, Radar, Satellite, BrainCircuit, Smartphone, Tractor, Wallet, ArrowRight } from 'lucide-react';

export default function Home() {
    const { t } = useI18n();
    const { isAuthenticated } = useAuth();
    useEffect(() => { wakeBackend(); }, []);

    const features = [
        { icon: <Sprout size={22} />, k: 'crop' },
        { icon: <Sun size={22} />, k: 'solar' },
        { icon: <Mic size={22} />, k: 'voice' },
        { icon: <TrendingUp size={22} />, k: 'market' },
        { icon: <Leaf size={22} />, k: 'carbon' },
        { icon: <Radar size={22} />, k: 'district' },
    ];
    const steps = [
        { icon: <Satellite size={20} />, k: 1 }, { icon: <BrainCircuit size={20} />, k: 2 }, { icon: <Smartphone size={20} />, k: 3 },
        { icon: <Tractor size={20} />, k: 4 }, { icon: <Wallet size={20} />, k: 5 },
    ];
    const targets = [
        { v: '+5–15%', k: 'energy' }, { v: '20–30%', k: 'water' }, { v: '3', k: 'langs' }, { v: '24×7', k: 'live' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--color-gray-50)' }}>
            <header style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%)', color: 'white' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1rem clamp(1rem, 4vw, 2rem)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #34d399, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={18} strokeWidth={2.5} color="#064e3b" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.125rem' }}>AgroVolt AI</div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <LanguageSwitcher variant="dark" />
                        <Link href={isAuthenticated ? '/dashboard' : '/login'} style={navBtn}>{isAuthenticated ? t('nav.dashboard') : t('auth.signIn')}</Link>
                    </div>
                </div>
                <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(2.5rem, 8vw, 5rem) clamp(1rem, 4vw, 2rem)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75 }}>{t('land.kicker')}</div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, margin: '0.75rem 0', maxWidth: 760, letterSpacing: '-0.02em' }}>
                        {t('land.title')}
                    </h1>
                    <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.1875rem)', opacity: 0.85, maxWidth: 640, lineHeight: 1.6 }}>{t('land.sub')}</p>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', flexWrap: 'wrap' }}>
                        <Link href={isAuthenticated ? '/dashboard' : '/register'} style={{ ...cta, background: '#fbbf24', color: '#064e3b' }}>
                            {isAuthenticated ? t('land.open') : t('land.start')} <ArrowRight size={16} />
                        </Link>
                        {!isAuthenticated && <Link href="/login" style={{ ...cta, background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>{t('auth.signIn')}</Link>}
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: 1120, margin: '0 auto', padding: '2.5rem clamp(1rem, 4vw, 2rem)' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: '-4.5rem' }}>
                    {targets.map((s) => (
                        <div key={s.k} className="card" style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-green-700)' }}>{s.v}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>{t('land.t.' + s.k)}</div>
                        </div>
                    ))}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', textAlign: 'center', marginTop: '0.5rem' }}>{t('land.targetsNote')}</div>

                <h2 style={h2}>{t('land.modules')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((f) => (
                        <div key={f.k} className="card">
                            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--color-green-50)', color: 'var(--color-green-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginTop: '0.75rem' }}>{t('land.f.' + f.k)}</div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', lineHeight: 1.6, marginTop: '0.375rem' }}>{t('land.f.' + f.k + '.d')}</p>
                        </div>
                    ))}
                </div>

                <h2 style={h2}>{t('land.how')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {steps.map((s) => (
                        <div key={s.k} className="card" style={{ position: 'relative' }}>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-green-600)' }}>{t('land.step', { n: s.k })}</div>
                            <div style={{ color: 'var(--color-green-700)', margin: '0.5rem 0' }}>{s.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{t('land.s' + s.k)}</div>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', lineHeight: 1.55, marginTop: '0.25rem' }}>{t('land.s' + s.k + '.d')}</p>
                        </div>
                    ))}
                </div>

                <div className="card" style={{ marginTop: '2.5rem', textAlign: 'center', background: 'linear-gradient(135deg, var(--color-green-50), var(--color-solar-50))' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 800 }}>{t('land.ctaTitle')}</div>
                    <p style={{ color: 'var(--color-gray-600)', margin: '0.5rem auto 1rem', maxWidth: 560 }}>{t('land.ctaSub')}</p>
                    <Link href={isAuthenticated ? '/dashboard' : '/register'} style={{ ...cta, background: 'var(--color-green-600)', color: 'white', display: 'inline-flex' }}>{isAuthenticated ? t('land.open') : t('land.start')} <ArrowRight size={16} /></Link>
                </div>
            </main>
            <footer style={{ textAlign: 'center', padding: '2rem 1rem', fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                {t('land.footer')}
            </footer>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, margin: '2.5rem 0 1rem' };
const cta: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.375rem', borderRadius: '999px', fontWeight: 700, textDecoration: 'none', fontSize: '0.9375rem' };
const navBtn: React.CSSProperties = { padding: '0.4rem 0.875rem', borderRadius: '999px', background: 'white', color: 'var(--color-green-800)', fontWeight: 700, fontSize: '0.8125rem', textDecoration: 'none' };
