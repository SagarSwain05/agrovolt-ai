'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import VoiceButton from '@/components/VoiceButton';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
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
                        /* extra bottom padding on mobile for bottom nav (80px nav + 16px breathing room) */
                        paddingBottom: '0',
                    }}
                >
                    {/*
                        On md+ screens: main content gets a left margin matching the sidebar width.
                        The sidebar sets --sidebar-width via CSS variable (260px or 72px collapsed).
                        On mobile: sidebar is hidden (display:none), so no margin needed.
                        The `pb-24` on mobile gives clearance for the bottom nav.
                    */}
                    <style>{`
                        @media (min-width: 768px) {
                            main { margin-left: var(--sidebar-width) !important; padding-bottom: 0 !important; }
                        }
                        @media (max-width: 767px) {
                            main { margin-left: 0 !important; padding-bottom: 96px !important; }
                        }
                    `}</style>
                    {children}
                </main>
                <BottomNav />
                <VoiceButton />
            </div>
        </AuthProvider>
    );
}
