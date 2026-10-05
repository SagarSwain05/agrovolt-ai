'use client';
// PWA helpers: service worker, web push, offline Odia voice, online status, offline scan queue.
import { useEffect, useState } from 'react';
import { notificationAPI, scanAPI } from './api';

export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { }); });
}

export function useOnline() {
    const [online, setOnline] = useState(true);
    useEffect(() => {
        setOnline(navigator.onLine);
        const on = () => setOnline(true), off = () => setOnline(false);
        window.addEventListener('online', on); window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    return online;
}

function b64ToUint8(b64: string) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Ask permission, subscribe this device and register it with the backend. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
    if (!pushSupported()) return 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    try {
        const cfg = (await notificationAPI.config()).data.data;
        if (!cfg.vapidPublicKey) return 'unsupported';
        const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(cfg.vapidPublicKey) }));
        await notificationAPI.subscribe(sub.toJSON());
        return 'granted';
    } catch {
        return 'error';
    }
}

/** Download the 38 MB Odia voice into the persistent cache for offline speech. */
export async function cacheOdiaVoice(): Promise<boolean> {
    if (!('caches' in window)) return false;
    try {
        const c = await caches.open('av-models');
        await c.addAll(['/models/mms-tts-ory/model.onnx', '/models/mms-tts-ory/vocab.json']);
        return true;
    } catch { return false; }
}

export async function isOdiaVoiceCached(): Promise<boolean> {
    if (typeof window === 'undefined' || !('caches' in window)) return false;
    try { return !!(await (await caches.open('av-models')).match('/models/mms-tts-ory/model.onnx')); } catch { return false; }
}

export function clearOfflineData() {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_DATA' });
}

// ── Offline scan queue (IndexedDB) ─────────────────────────────────────────
export interface QueuedScan { id?: number; mode: 'crop' | 'panel'; image: string; createdAt: number }

function db(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open('agrovolt', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('scanQueue', { keyPath: 'id', autoIncrement: true });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const d = await db();
    return new Promise((resolve, reject) => {
        const req = fn(d.transaction('scanQueue', mode).objectStore('scanQueue'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export const scanQueue = {
    add: (s: QueuedScan) => tx('readwrite', (st) => st.add(s)),
    all: () => tx<QueuedScan[]>('readonly', (st) => st.getAll() as IDBRequest<QueuedScan[]>),
    remove: (id: number) => tx('readwrite', (st) => st.delete(id)),
    /** Send queued scans; returns results of those that succeeded. */
    async flush(): Promise<{ id: number; mode: string; result: Record<string, unknown> }[]> {
        if (!navigator.onLine) return [];
        const items = await scanQueue.all().catch(() => []);
        const done = [];
        for (const it of items) {
            try {
                const r = it.mode === 'crop' ? await scanAPI.crop(it.image) : await scanAPI.panel(it.image);
                if (r.data?.success) { await scanQueue.remove(it.id!); done.push({ id: it.id!, mode: it.mode, result: r.data.data }); }
            } catch { break; }
        }
        return done;
    },
};
