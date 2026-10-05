'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function OfflinePage() {
    const { t } = useI18n();
    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--color-gray-50)' }}>
            <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
                <WifiOff size={36} color="var(--color-gray-500)" style={{ margin: '0 auto' }} />
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0 0.375rem' }}>{t('pwa.offlineTitle')}</h1>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', lineHeight: 1.6 }}>{t('pwa.offlineBody')}</p>
                <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>{t('nav.dashboard')}</Link>
            </div>
        </div>
    );
}
