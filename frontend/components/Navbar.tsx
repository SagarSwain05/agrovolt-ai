'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
    Bell,
    CloudSun,
    Globe,
    LogOut,
    User,
    Thermometer,
} from 'lucide-react';

interface NavbarProps {
    title: string;
    subtitle?: string;
}

export default function Navbar({ title, subtitle }: NavbarProps) {
    const { user, logout } = useAuth();
    const [lang, setLang] = useState('EN');

    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 40,
                height: 'var(--navbar-height)',
                background: 'var(--surface-glass)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid var(--color-gray-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.5rem',
            }}
        >
            {/* Left — Title */}
            <div>
                <h1 style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    color: 'var(--color-gray-900)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                }}>
                    {title}
                </h1>
                {subtitle && (
                    <p style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-gray-500)',
                        marginTop: '1px',
                        fontFamily: 'var(--font-body)',
                    }}>
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Right — Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Weather */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-green-50)',
                        border: '1px solid var(--color-green-200)',
                        fontSize: '0.8125rem',
                        color: 'var(--color-green-700)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                    }}
                >
                    <Thermometer size={14} strokeWidth={2} />
                    28°C
                </div>

                {/* Notifications */}
                <button
                    style={{
                        position: 'relative',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'var(--color-gray-100)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-gray-600)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <Bell size={16} strokeWidth={1.75} />
                    <span
                        style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: 'var(--color-red-500)',
                            border: '1.5px solid white',
                        }}
                    />
                </button>

                {/* Language */}
                <div style={{ position: 'relative' }}>
                    <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        style={{
                            appearance: 'none',
                            padding: '0.375rem 1.75rem 0.375rem 0.625rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-gray-200)',
                            background: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-gray-600)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
                        }}
                    >
                        <option value="EN">EN</option>
                        <option value="HI">हिंदी</option>
                        <option value="OR">ଓଡ଼ିଆ</option>
                    </select>
                    <Globe size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-gray-400)' }} />
                </div>

                {/* User / Login */}
                {user ? (
                    <button
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0.375rem 0.75rem',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-gray-200)',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-gray-600)',
                            fontFamily: 'var(--font-body)',
                        }}
                    >
                        <User size={14} strokeWidth={1.75} />
                        {user.name?.split(' ')[0] || 'Account'}
                    </button>
                ) : (
                    <a
                        href="/login"
                        className="btn-primary"
                        style={{ fontSize: '0.8125rem', padding: '0.375rem 1rem', textDecoration: 'none' }}
                    >
                        Login
                    </a>
                )}
            </div>
        </header>
    );
}
