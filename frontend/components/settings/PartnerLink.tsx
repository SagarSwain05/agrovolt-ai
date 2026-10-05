'use client';

import React, { useEffect, useState } from 'react';
import { partnerAPI, apiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Link2, Unlink, Copy } from 'lucide-react';

export default function PartnerLink() {
    const { t } = useI18n();
    const { user } = useAuth();
    const [partner, setPartner] = useState<{ name: string; role: string; code: string } | null>(null);
    const [code, setCode] = useState('');
    const [msg, setMsg] = useState<string | null>(null);
    useEffect(() => { partnerAPI.myPartner().then((r) => setPartner(r.data.data)).catch(() => { }); }, []);

    if (user && ['epc', 'fpo', 'admin'].includes(user.role)) {
        return (
            <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                {t('partner.yourCode')}: <b style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>{user.partnerCode}</b>
                <button onClick={() => navigator.clipboard?.writeText(user.partnerCode || '')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-gray-500)' }} aria-label="copy"><Copy size={13} /></button>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{t('partner.shareCode')}</div>
            </div>
        );
    }
    return (
        <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', lineHeight: 1.55 }}>{t('partner.linkSub')}</p>
            {partner ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem' }}>{t('partner.linkedTo')}: <b>{partner.name}</b> ({t('role.' + partner.role)} · {partner.code})</span>
                    <button className="btn-ghost" onClick={async () => { await partnerAPI.unlink(); setPartner(null); }} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8125rem' }}><Unlink size={13} /> {t('partner.unlink')}</button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <input className="input" style={{ flex: 1, minWidth: 160, textTransform: 'uppercase' }} placeholder="EPC-XXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
                    <button className="btn-primary" onClick={async () => { try { const r = await partnerAPI.link(code); setPartner(r.data.data.partner); setMsg(null); } catch (e) { setMsg(apiError(e)); } }} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8125rem' }}><Link2 size={14} /> {t('partner.link')}</button>
                </div>
            )}
            {msg && <div style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem', marginTop: '0.375rem' }}>{msg}</div>}
        </div>
    );
}
