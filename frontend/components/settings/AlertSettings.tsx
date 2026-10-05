'use client';

import React, { useEffect, useState } from 'react';
import { notificationAPI, apiError } from '@/lib/api';
import { enablePush, pushSupported } from '@/lib/pwa';
import { useI18n } from '@/lib/i18n';
import { BellRing, Send } from 'lucide-react';

interface Cfg { vapidPublicKey: string | null; available: { email?: boolean; push: boolean; sms: boolean; whatsapp: boolean }; prefs: { email?: boolean; push?: boolean; sms?: boolean; whatsapp?: boolean; minLevel?: string }; phone: string | null; email?: string; emailVerified?: boolean; pushDevices: number }

export default function AlertSettings() {
    const { t } = useI18n();
    const [cfg, setCfg] = useState<Cfg | null>(null);
    const [msg, setMsg] = useState<string | null>(null);
    const load = () => notificationAPI.config().then((r) => setCfg(r.data.data)).catch(() => { });
    useEffect(() => { load(); }, []);
    if (!cfg) return null;

    const setPref = async (p: Record<string, unknown>) => {
        try { const r = await notificationAPI.prefs(p); setCfg({ ...cfg, prefs: r.data.data }); } catch (e) { setMsg(apiError(e)); }
    };
    const turnOnPush = async () => {
        const r = await enablePush();
        setMsg(t('alerts.push.' + r));
        load();
    };
    const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid var(--color-gray-100)', flexWrap: 'wrap' };

    return (
        <div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', lineHeight: 1.55, marginBottom: '0.5rem' }}>{t('alerts.sub')}</p>
            <div style={row}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontSize: '0.875rem' }}>{t('alerts.pushTitle')}</b>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{cfg.pushDevices ? t('alerts.pushOn', { n: cfg.pushDevices }) : t('alerts.pushOff')}</div>
                </div>
                {pushSupported() && cfg.available.push ? (
                    <button className="btn-primary" onClick={turnOnPush} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8125rem' }}><BellRing size={14} /> {t('alerts.enablePush')}</button>
                ) : <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{t('alerts.pushUnsupported')}</span>}
            </div>
            <label style={{ ...row, cursor: 'pointer' }}>
                <input type="checkbox" disabled={!cfg.available.email || !cfg.emailVerified} checked={cfg.prefs.email !== false} onChange={(e) => setPref({ email: e.target.checked })} />
                <div style={{ flex: 1 }}>
                    <b style={{ fontSize: '0.875rem' }}>{t('alerts.email')}</b>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                        {!cfg.available.email ? t('alerts.notConfigured') : !cfg.emailVerified ? t('alerts.emailUnverified') : t('alerts.toEmail', { e: cfg.email || '' })}
                    </div>
                </div>
            </label>
            {(['sms', 'whatsapp'] as const).filter((ch) => cfg.available[ch]).map((ch) => (
                <label key={ch} style={{ ...row, cursor: cfg.available[ch] ? 'pointer' : 'default' }}>
                    <input type="checkbox" disabled={!cfg.available[ch] || !cfg.phone} checked={!!cfg.prefs[ch]} onChange={(e) => setPref({ [ch]: e.target.checked })} />
                    <div style={{ flex: 1 }}>
                        <b style={{ fontSize: '0.875rem' }}>{t('alerts.' + ch)}</b>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                            {!cfg.available[ch] ? t('alerts.notConfigured') : !cfg.phone ? t('alerts.needPhone') : t('alerts.toPhone', { p: cfg.phone })}
                        </div>
                    </div>
                </label>
            ))}
            <div style={{ ...row, borderBottom: 'none' }}>
                <span style={{ fontSize: '0.875rem' }}>{t('alerts.minLevel')}</span>
                <select className="select" style={{ width: 'auto' }} value={cfg.prefs.minLevel || 'medium'} onChange={(e) => setPref({ minLevel: e.target.value })}>
                    <option value="info">{t('alerts.lvl.info')}</option>
                    <option value="medium">{t('alerts.lvl.medium')}</option>
                    <option value="high">{t('alerts.lvl.high')}</option>
                </select>
                <button className="btn-secondary" onClick={async () => { await notificationAPI.test(); setMsg(t('alerts.testSent')); }} style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.8125rem' }}><Send size={13} /> {t('alerts.test')}</button>
            </div>
            {msg && <div style={{ fontSize: '0.8125rem', color: 'var(--color-green-700)', marginTop: '0.375rem' }}>{msg}</div>}
        </div>
    );
}
