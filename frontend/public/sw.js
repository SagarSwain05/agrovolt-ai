/* AgroVolt AI service worker — offline-first shell, cached data, web push. */
const VERSION = 'av-v3';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const MODELS = 'av-models'; // not versioned: the 38 MB Odia voice survives app updates
const PRECACHE = ['/', '/dashboard', '/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
// API GETs worth keeping for offline use (last known good response)
const DATA_PATHS = /\/api\/(dashboard|iot\/latest|farm$|crop$|notifications(\?|$)|notifications\/risk|solar\/optimize|solar\/history|carbon\/wallet|market\/prices|weather\/|disease\/history|assistant\/status)/;

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE).catch(() => { })).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        for (const k of await caches.keys()) if (!k.startsWith(VERSION) && k !== MODELS) await caches.delete(k);
        await self.clients.claim();
    })());
});

self.addEventListener('message', (e) => {
    if (e.data?.type === 'CLEAR_DATA') caches.delete(DATA);
    if (e.data?.type === 'CACHE_ODIA_MODEL') {
        e.waitUntil(caches.open(MODELS).then((c) => c.addAll(['/models/mms-tts-ory/model.onnx', '/models/mms-tts-ory/vocab.json'])).then(() => notifyClients({ type: 'ODIA_MODEL_CACHED' })).catch(() => notifyClients({ type: 'ODIA_MODEL_FAILED' })));
    }
});

async function notifyClients(msg) {
    for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg);
}

async function networkFirst(req, cacheName, fallbackUrl) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
    } catch {
        const hit = await cache.match(req, { ignoreVary: true });
        if (hit) {
            const h = new Headers(hit.headers);
            h.set('X-AgroVolt-Offline', '1');
            return new Response(await hit.blob(), { status: hit.status, headers: h });
        }
        if (fallbackUrl) return (await caches.match(fallbackUrl)) || Response.error();
        return new Response(JSON.stringify({ success: false, offline: true, message: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
}

async function cacheFirst(req, cacheName) {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
    return res;
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (req.mode === 'navigate') {
        e.respondWith(networkFirst(req, SHELL, '/offline'));
        return;
    }
    if (url.origin === self.location.origin) {
        if (url.pathname.startsWith('/models/')) { e.respondWith(caches.match(req).then((h) => h || fetch(req))); return; }
        if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?|webmanifest)$/.test(url.pathname)) { e.respondWith(cacheFirst(req, STATIC)); return; }
        return;
    }
    // Backend API (cross-origin) — keep last good copy for offline
    if (DATA_PATHS.test(url.pathname + url.search)) { e.respondWith(networkFirst(req, DATA)); return; }
    // Fonts & CDN runtime (onnxruntime-web) — cache-first
    if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net\/npm\/onnxruntime-web/.test(url.href)) e.respondWith(cacheFirst(req, STATIC));
});

// ── Web push ────────────────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
    let d = {};
    try { d = e.data.json(); } catch { d = { title: 'AgroVolt AI', body: e.data?.text() }; }
    e.waitUntil((async () => {
        await self.registration.showNotification(d.title || 'AgroVolt AI', {
            body: d.body, tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/dashboard' },
            vibrate: d.level === 'high' ? [200, 100, 200] : [100], requireInteraction: d.level === 'high',
        });
        notifyClients({ type: 'PUSH', payload: d });
    })());
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const url = e.notification.data?.url || '/dashboard';
    e.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
        return self.clients.openWindow(url);
    })());
});
