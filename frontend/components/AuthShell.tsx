'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';

export default function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle: string; children: React.ReactNode; wide?: boolean }) {
    const { t } = useI18n();
    return (
        <div style={{ width: '100%', maxWidth: wide ? 560 : 420, animation: 'fadeIn 0.6s ease forwards', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}><LanguageSwitcher variant="dark" full /></div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 8px 24px rgba(52,211,153,0.3)',
                }}>
                    <Zap size={28} strokeWidth={2.5} color="#064e3b" />
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>AgroVolt AI</h1>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{t('auth.motto')}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 'var(--radius-2xl)', padding: 'clamp(1.25rem, 5vw, 2rem)', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{title}</h2>
                <p style={{ color: 'var(--color-gray-500)', fontSize: '0.8125rem', margin: '0.25rem 0 1.25rem' }}>{subtitle}</p>
                {children}
            </div>
        </div>
    );
}
