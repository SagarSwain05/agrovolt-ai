'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnline, scanQueue } from '@/lib/pwa';
import { useI18n } from '@/lib/i18n';

/** Shows offline state and syncs queued scans when the connection returns. */
export default function OfflineBanner() {
    const online = useOnline();
    const { t } = useI18n();
    const [synced, setSynced] = useState(0);

    useEffect(() => {
        if (!online) return;
        scanQueue.flush().then((d) => { if (d.length) { setSynced(d.length); setTimeout(() => setSynced(0), 6000); } }).catch(() => { });
    }, [online]);

    if (online && !synced) return null;
    return (
        <div role="status" style={{
            position: 'sticky', top: 0, zIndex: 45, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
            padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
            background: online ? 'var(--color-green-600)' : 'var(--color-gray-800)', color: 'white',
        }}>
            {online ? <><RefreshCw size={13} /> {t('pwa.synced', { n: synced })}</> : <><WifiOff size={13} /> {t('pwa.offlineBar')}</>}
        </div>
    );
}
