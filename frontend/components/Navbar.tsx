'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Bell, Globe, User, Thermometer, Moon, Zap } from 'lucide-react';

interface NavbarProps {
    title: string;
    subtitle?: string;
    temperature?: number;
    isNight?: boolean;
    weatherIcon?: React.ReactNode;
}

export default function Navbar({ title, subtitle, temperature, isNight, weatherIcon }: NavbarProps) {
    const { user, logout } = useAuth();
    const [liveTemp, setLiveTemp] = useState<number | null>(null);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        fetch(`${apiUrl}/api/weather/current?lat=20.29&lon=85.82`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data?.temperature) setLiveTemp(data.data.temperature);
            })
            .catch(() => { });
    }, []);

    const displayTemp = temperature ?? liveTemp ?? 28;

    return (
        <>
            {/* ── Mobile-only brand bar (AgroVolt AI logo on top) ── */}
            <div className="md:hidden flex" style={{
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem clamp(0.75rem, 4vw, 1.5rem)',
                background: 'linear-gradient(135deg, #064e3b, #047857)',
                color: 'white',
            }}>
                <div style={{
                    width: '28px', height: '28px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #34d399, #fbbf24)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Zap size={16} strokeWidth={2.5} color="#064e3b" />
                </div>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.02em' }}>
                        AgroVolt AI
                    </div>
                    <div style={{ fontSize: '0.5rem', opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                        Bio-Solar Intelligence
                    </div>
                </div>
                {/* Push user avatar + temp to right */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Weather compact */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.2rem 0.5rem', borderRadius: '999px',
                        background: 'rgba(255,255,255,0.15)',
                        fontSize: '0.6875rem', fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                    }}>
                        {weatherIcon || (isNight ? <Moon size={11} /> : <Thermometer size={11} />)}
                        {displayTemp}°C
                    </div>
                    {/* User pill */}
                    {user && (
                        <button onClick={logout} style={{
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            background: 'rgba(255,255,255,0.1)', border: 'none',
                            borderRadius: '999px', padding: '0.2rem 0.5rem',
                            color: 'white', fontSize: '0.6875rem', fontWeight: 600,
                            cursor: 'pointer',
                        }}>
                            <User size={12} strokeWidth={1.75} />
                            {user.name?.split(' ')[0]?.[0] || 'U'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Navbar Header ── */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200"
                style={{
                    height: 'var(--navbar-height)',
                    background: 'var(--surface-glass)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    padding: '0 clamp(0.75rem, 4vw, 1.5rem)',
                    minWidth: 0,
                    overflow: 'hidden',
                }}
            >
                {/* Left — Title + subtitle (always visible) */}
                <div className="min-w-0 flex-1 mr-2">
                    <h1 className="truncate"
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(0.9375rem, 3.5vw, 1.375rem)',
                            fontWeight: 700,
                            color: 'var(--color-gray-900)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1.2,
                        }}
                    >
                        {title}
                    </h1>
                    {/* Subtitle: always visible, just smaller on mobile */}
                    {subtitle && (
                        <p className="truncate"
                            style={{
                                fontSize: 'clamp(0.5625rem, 2vw, 0.75rem)',
                                color: 'var(--color-gray-500)',
                                marginTop: '1px',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Right — Actions (single temperature, no duplicate) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Single weather pill — always visible, sized responsively */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
                            fontWeight: 600,
                            background: isNight ? 'var(--color-blue-50)' : 'var(--color-green-50)',
                            border: `1px solid ${isNight ? 'var(--color-blue-200)' : 'var(--color-green-200)'}`,
                            color: isNight ? 'var(--color-blue-700)' : 'var(--color-green-700)',
                            whiteSpace: 'nowrap' as const,
                        }}
                    >
                        {weatherIcon || (isNight ? <Moon size={12} strokeWidth={2} /> : <Thermometer size={12} strokeWidth={2} />)}
                        {displayTemp}°C
                    </div>

                    {/* Notifications */}
                    <button
                        aria-label="Notifications"
                        className="relative flex items-center justify-center rounded-full"
                        style={{
                            width: 'clamp(28px, 7vw, 36px)',
                            height: 'clamp(28px, 7vw, 36px)',
                            background: 'var(--color-gray-100)',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-gray-600)',
                        }}
                    >
                        <Bell size={14} strokeWidth={1.75} />
                        <span style={{
                            position: 'absolute', top: '5px', right: '5px',
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: 'var(--color-red-500)', border: '1.5px solid white',
                        }} />
                    </button>

                    {/* Language — hidden on mobile */}
                    <div className="relative hidden sm:block">
                        <select defaultValue="EN" aria-label="Language" style={{
                            appearance: 'none' as const,
                            padding: '0.25rem 1.25rem 0.25rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-gray-200)',
                            background: 'white', fontSize: '0.6875rem', fontWeight: 600,
                            color: 'var(--color-gray-600)', cursor: 'pointer',
                        }}>
                            <option value="EN">EN</option>
                            <option value="HI">हिंदी</option>
                            <option value="OR">ଓଡ଼ିଆ</option>
                        </select>
                        <Globe size={10} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as const, color: 'var(--color-gray-400)' }} />
                    </div>

                    {/* User — hidden on mobile (shown in brand bar above) */}
                    <div className="hidden md:block">
                        {user ? (
                            <button onClick={logout} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                                style={{
                                    border: '1px solid var(--color-gray-200)',
                                    background: 'white', cursor: 'pointer',
                                    color: 'var(--color-gray-600)', fontFamily: 'var(--font-body)',
                                    whiteSpace: 'nowrap' as const,
                                }}
                            >
                                <User size={13} strokeWidth={1.75} />
                                {user.name?.split(' ')[0] || 'Account'}
                            </button>
                        ) : (
                            <a href="/login" className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', textDecoration: 'none' }}>
                                Login
                            </a>
                        )}
                    </div>
                </div>
            </header>
        </>
    );
}
