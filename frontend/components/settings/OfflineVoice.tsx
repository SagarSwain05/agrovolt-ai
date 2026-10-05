'use client';

import React, { useEffect, useState } from 'react';
import { cacheOdiaVoice, isOdiaVoiceCached } from '@/lib/pwa';
import { useI18n } from '@/lib/i18n';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';

export default function OfflineVoice() {
    const { t } = useI18n();
    const [state, setState] = useState<'unknown' | 'cached' | 'idle' | 'loading' | 'failed'>('unknown');
    useEffect(() => { isOdiaVoiceCached().then((c) => setState(c ? 'cached' : 'idle')); }, []);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, fontSize: '0.8125rem', color: 'var(--color-gray-600)', lineHeight: 1.55 }}>{t('offline.voiceSub')}</div>
            {state === 'cached' ? <span style={{ color: 'var(--color-green-700)', fontSize: '0.8125rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}><CheckCircle2 size={14} /> {t('offline.voiceReady')}</span>
                : <button className="btn-secondary" disabled={state === 'loading'} onClick={async () => { setState('loading'); setState((await cacheOdiaVoice()) ? 'cached' : 'failed'); }} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8125rem' }}>
                    {state === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {state === 'failed' ? t('common.retry') : t('offline.voiceDownload')}
                </button>}
        </div>
    );
}
