'use client';

import React from 'react';
import { LANGS, useI18n } from '@/lib/i18n';
import { Globe } from 'lucide-react';
import type { Lang } from '@/lib/api';

/** Segmented EN / हि / ଓ switch. */
export default function LanguageSwitcher({ variant = 'light', full = false }: { variant?: 'light' | 'dark'; full?: boolean }) {
    const { lang, setLang, t } = useI18n();
    const dark = variant === 'dark';
    return (
        <div role="radiogroup" aria-label={t('common.language')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px', borderRadius: '999px',
            background: dark ? 'rgba(255,255,255,0.12)' : 'var(--color-gray-100)',
            border: dark ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--color-gray-200)',
        }}>
            {!full && <Globe size={11} style={{ margin: '0 2px 0 4px', color: dark ? 'rgba(255,255,255,0.7)' : 'var(--color-gray-400)' }} />}
            {LANGS.map((l) => {
                const active = l.code === lang;
                return (
                    <button
                        key={l.code}
                        role="radio"
                        aria-checked={active}
                        title={l.label}
                        onClick={() => setLang(l.code as Lang)}
                        style={{
                            border: 'none', cursor: 'pointer', borderRadius: '999px',
                            padding: full ? '0.375rem 0.875rem' : '0.15rem 0.5rem',
                            fontSize: full ? '0.8125rem' : '0.6875rem', fontWeight: 700, lineHeight: 1.4,
                            background: active ? (dark ? 'white' : 'var(--color-green-600)') : 'transparent',
                            color: active ? (dark ? 'var(--color-green-800)' : 'white') : (dark ? 'rgba(255,255,255,0.8)' : 'var(--color-gray-600)'),
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {full ? l.label : l.short}
                    </button>
                );
            })}
        </div>
    );
}
