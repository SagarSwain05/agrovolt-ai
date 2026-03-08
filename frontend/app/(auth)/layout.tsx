'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div
                style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #064e3b 0%, #047857 30%, #059669 60%, #10b981 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background decoration */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-20%',
                        right: '-10%',
                        width: '500px',
                        height: '500px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.03)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-15%',
                        left: '-5%',
                        width: '400px',
                        height: '400px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.04)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '10%',
                        left: '10%',
                        fontSize: '4rem',
                        opacity: 0.05,
                    }}
                >
                    🌾⚡
                </div>
                {children}
            </div>
        </AuthProvider>
    );
}
