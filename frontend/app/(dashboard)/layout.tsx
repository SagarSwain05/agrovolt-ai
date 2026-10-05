'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { FarmProvider } from '@/lib/farm';
import { useI18n } from '@/lib/i18n';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import Sahayak from '@/components/Sahayak';
import OfflineBanner from '@/components/OfflineBanner';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    const { t } = useI18n();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) router.replace('/login');
    }, [loading, isAuthenticated, router]);

    if (loading || !isAuthenticated) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-gray-500)', background: 'var(--color-gray-50)' }}>
                <Loader2 size={18} className="animate-spin" /> {t('common.loading')}
            </div>
        );
    }

    return (
        <FarmProvider>
            <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden', width: '100%' }}>
                <Sidebar />
                <main
                    className="w-full min-w-0"
                    style={{
                        flex: 1,
                        background: 'var(--color-gray-50)',
                        minHeight: '100vh',
                        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflowX: 'hidden',
                    }}
                >
                    <style>{`
                        @media (min-width: 768px) {
                            main { margin-left: var(--sidebar-width) !important; padding-bottom: 0 !important; }
                        }
                        @media (max-width: 767px) {
                            main { margin-left: 0 !important; padding-bottom: 96px !important; }
                        }
                    `}</style>
                    <OfflineBanner />
                    {children}
                </main>
                <BottomNav />
                <Sahayak />
            </div>
        </FarmProvider>
    );
}
