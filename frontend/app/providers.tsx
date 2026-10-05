'use client';

import React, { useCallback, useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { farmAPI, type Lang } from '@/lib/api';

function LanguageBridge({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, updateUser } = useAuth();
    // Persist the choice to the profile so voice replies and briefings follow it.
    const onChange = useCallback((l: Lang) => {
        if (!isAuthenticated) return;
        updateUser({ language: l });
        farmAPI.updateMe({ language: l }).catch(() => { });
    }, [isAuthenticated, updateUser]);
    return <LanguageProvider onChange={onChange}>{children}</LanguageProvider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => { registerServiceWorker(); }, []);
    return (
        <AuthProvider>
            <LanguageBridge>{children}</LanguageBridge>
        </AuthProvider>
    );
}
