'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Volume2, CheckCheck } from 'lucide-react';
import { notificationAPI, type Lang } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { speak } from '@/lib/speech';

interface Note { _id: string; type: string; level: 'info' | 'medium' | 'high'; title: string; body: string; lang?: Lang; read: boolean; createdAt: string; data?: { url?: string } }

const COLOR = { high: 'var(--color-red-500)', medium: 'var(--color-solar-500)', info: 'var(--color-green-500)' };

export default function NotificationBell() {
    const { t, lang, date } = useI18n();
    const [items, setItems] = useState<Note[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const load = () => notificationAPI.list().then((r) => { setItems(r.data.data.items); setUnread(r.data.data.unread); }).catch(() => { });
    useEffect(() => {
        load();
        const id = setInterval(() => document.visibilityState === 'visible' && load(), 120000);
        const onPush = () => load();
        navigator.serviceWorker?.addEventListener?.('message', onPush);
        return () => { clearInterval(id); navigator.serviceWorker?.removeEventListener?.('message', onPush); };
    }, []);
    useEffect(() => {
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const markAll = async () => { await notificationAPI.markRead().catch(() => { }); setUnread(0); setItems((x) => x.map((n) => ({ ...n, read: true }))); };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button aria-label={t('notif.title')} onClick={() => { setOpen(!open); if (!open && unread) markAll(); }} style={{
                position: 'relative', width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--color-gray-200)', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-gray-600)',
            }}>
                <Bell size={15} />
                {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--color-red-500)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{unread > 9 ? '9+' : unread}</span>}
            </button>
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '115%', width: 'min(360px, calc(100vw - 24px))', maxHeight: 440, overflowY: 'auto',
                    background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', zIndex: 70,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--color-gray-100)' }}>
                        <b style={{ fontSize: '0.875rem' }}>{t('notif.title')}</b>
                        <button onClick={markAll} style={{ border: 'none', background: 'none', color: 'var(--color-green-700)', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}><CheckCheck size={13} /> {t('notif.markRead')}</button>
                    </div>
                    {items.length === 0 && <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-gray-500)' }}>{t('notif.empty')}</div>}
                    {items.map((n) => (
                        <div key={n._id} style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--color-gray-50)', borderLeft: `3px solid ${COLOR[n.level] || COLOR.info}`, background: n.read ? 'white' : 'var(--color-green-50)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{n.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)', lineHeight: 1.5, marginTop: 2 }}>{n.body}</div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginTop: 4 }}>
                                        {date(n.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        {n.data?.url && <> · <Link href={n.data.url} onClick={() => setOpen(false)} style={{ color: 'var(--color-green-700)' }}>{t('notif.open')}</Link></>}
                                    </div>
                                </div>
                                <button aria-label={t('dash.listen')} onClick={() => speak(`${n.title}. ${n.body}`, (n.lang as Lang) || lang)} style={{ border: 'none', background: 'var(--color-gray-100)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                    <Volume2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <Link href="/settings#alerts" onClick={() => setOpen(false)} style={{ display: 'block', padding: '0.625rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-green-700)' }}>{t('notif.settings')}</Link>
                </div>
            )}
        </div>
    );
}
