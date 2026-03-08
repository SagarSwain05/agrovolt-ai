'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import VoiceButton from '@/components/VoiceButton';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar />
                <main
                    style={{
                        flex: 1,
                        marginLeft: 'var(--sidebar-width)',
                        background: 'var(--color-gray-50)',
                        minHeight: '100vh',
                        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    {children}
                </main>
                <VoiceButton />
            </div>
        </AuthProvider>
    );
}
