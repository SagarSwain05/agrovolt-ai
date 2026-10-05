'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useFarm } from '@/lib/farm';
import { weatherAPI } from '@/lib/api';
import LanguageSwitcher from './LanguageSwitcher';
import { User, Thermometer, Moon, Zap, Settings, LogOut, CloudSun } from 'lucide-react';

interface NavbarProps {
    title: string;
    subtitle?: string;
    temperature?: number;
    isNight?: boolean;
    weatherIcon?: React.ReactNode;
}

export default function Navbar({ title, subtitle, temperature, isNight, weatherIcon }: NavbarProps) {
    const { user, logout, waking } = useAuth();
    const { t } = useI18n();
    const { farm } = useFarm();
    const [live, setLive] = useState<{ temp: number; night: boolean } | null>(null);
    const [menu, setMenu] = useState(false);

    const lat = farm?.location?.latitude;
    const lon = farm?.location?.longitude;
    useEffect(() => {
        if (temperature != null || lat == null || lon == null) return;
        weatherAPI.getCurrent(lat, lon)
            .then((res) => res.data.success && setLive({ temp: res.data.data.temperature, night: !res.data.data.isDay }))
            .catch(() => { });
    }, [lat, lon, temperature]);

    const displayTemp = temperature ?? live?.temp;
    const night = isNight ?? live?.night ?? false;

    const pill = (
        <>
            {weatherIcon || (night ? <Moon size={12} strokeWidth={2} /> : displayTemp != null ? <Thermometer size={12} strokeWidth={2} /> : <CloudSun size={12} />)}
            {displayTemp != null ? `${displayTemp}°C` : '—'}
        </>
    );

    return (
        <>
            {/* ── Mobile brand bar ── */}
            <div className="md:hidden flex" style={{
                alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem clamp(0.75rem, 4vw, 1.5rem)',
                background: 'linear-gradient(135deg, #064e3b, #047857)', color: 'white',
            }}>
                <div style={{
                    width: '28px', height: '28px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #34d399, #fbbf24)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Zap size={16} strokeWidth={2.5} color="#064e3b" />
                </div>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.02em' }}>AgroVolt AI</div>
                    <div style={{ fontSize: '0.5rem', opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{t('brand.tagline')}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                        background: 'rgba(255,255,255,0.15)', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                    }}>{pill}</div>
                    <LanguageSwitcher variant="dark" />
                </div>
            </div>

            {waking && (
                <div style={{ background: 'var(--color-solar-50)', color: 'var(--color-solar-700)', fontSize: '0.75rem', padding: '0.375rem 1rem', textAlign: 'center', borderBottom: '1px solid var(--color-solar-200)' }}>
                    {t('common.waking')}
                </div>
            )}

            {/* ── Main header ── */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200"
                style={{
                    height: 'var(--navbar-height)', background: 'var(--surface-glass)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    padding: '0 clamp(0.75rem, 4vw, 1.5rem)', minWidth: 0,
                }}
            >
                <div className="min-w-0 flex-1 mr-2">
                    <h1 className="truncate" style={{
                        fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9375rem, 3.5vw, 1.375rem)', fontWeight: 700,
                        color: 'var(--color-gray-900)', letterSpacing: '-0.02em', lineHeight: 1.25,
                    }}>{title}</h1>
                    {subtitle && (
                        <p className="truncate" style={{ fontSize: 'clamp(0.5625rem, 2vw, 0.75rem)', color: 'var(--color-gray-500)', marginTop: '1px', fontFamily: 'var(--font-body)' }}>
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full" style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600,
                        background: night ? 'var(--color-blue-50)' : 'var(--color-green-50)',
                        border: `1px solid ${night ? 'var(--color-blue-200)' : 'var(--color-green-200)'}`,
                        color: night ? 'var(--color-blue-700)' : 'var(--color-green-700)', whiteSpace: 'nowrap' as const,
                    }}>{pill}</div>

                    <div className="hidden md:block"><LanguageSwitcher /></div>

                    {user && (
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => setMenu(!menu)} aria-label={t('nav.account')} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                                style={{ border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', color: 'var(--color-gray-600)', whiteSpace: 'nowrap' as const }}>
                                <User size={13} strokeWidth={1.75} />
                                <span className="hidden sm:inline">{user.name?.split(' ')[0]}</span>
                            </button>
                            {menu && (
                                <div onMouseLeave={() => setMenu(false)} style={{
                                    position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid var(--color-gray-200)',
                                    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', minWidth: '180px', padding: '0.375rem', zIndex: 60,
                                }}>
                                    <div style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem', color: 'var(--color-gray-500)', borderBottom: '1px solid var(--color-gray-100)', marginBottom: '0.25rem' }}>
                                        {user.email}
                                    </div>
                                    <Link href="/settings" onClick={() => setMenu(false)} style={menuItem}><Settings size={14} /> {t('nav.settings')}</Link>
                                    <button onClick={logout} style={{ ...menuItem, width: '100%', border: 'none', background: 'none', color: 'var(--color-red-600)' }}><LogOut size={14} /> {t('nav.logout')}</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>
        </>
    );
}

const menuItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', fontSize: '0.8125rem',
    color: 'var(--color-gray-700)', textDecoration: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-body)',
};
