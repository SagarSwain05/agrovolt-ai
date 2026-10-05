import axios from 'axios';

// NEXT_PUBLIC_API_URL is the backend origin (with or without a trailing /api).
const ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/+$/, '').replace(/\/api$/, '');
export const API_ORIGIN = ORIGIN;
export const API_BASE = `${ORIGIN}/api`;

export const TOKEN_KEY = 'agrovolt_token';
export const USER_KEY = 'agrovolt_user';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

const api = axios.create({
    baseURL: API_BASE,
    // Render's free tier sleeps; the first request after idle can take ~50 s.
    timeout: 70000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Expired/invalid session → back to login (only for requests that carried a token)
        if (error.response?.status === 401 && error.config?.headers?.Authorization && typeof window !== 'undefined') {
            try {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
            } catch { /* storage unavailable */ }
            if (!window.location.pathname.startsWith('/login')) window.location.href = '/login?expired=1';
        }
        return Promise.reject(error);
    }
);

export default api;

/** Extract a user-facing message from an axios error. */
export function apiError(e: unknown, fallback = 'Something went wrong'): string {
    const err = e as { response?: { data?: { message?: string } }; code?: string; message?: string };
    if (err?.code === 'ECONNABORTED') return 'Server is taking too long to respond. Please try again.';
    return err?.response?.data?.message || err?.message || fallback;
}

/** Ping the backend so a sleeping Render instance starts waking up early. */
export function wakeBackend() {
    if (typeof window === 'undefined') return;
    fetch(`${ORIGIN}/health`, { cache: 'no-store' }).catch(() => { });
}

// ============================================
// Typed service helpers
// ============================================

export type Lang = 'en' | 'hi' | 'or';

export const authAPI = {
    login: (email: string, password: string) => api.post('/auth/login', { email, password }),
    register: (data: Record<string, unknown>) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
    verifyEmail: (email: string, code: string) => api.post('/auth/verify-email', { email, code }),
    resendCode: (email: string) => api.post('/auth/resend-code', { email }),
    forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
    resetPassword: (email: string, code: string, password: string) => api.post('/auth/reset-password', { email, code, password }),
};

export const farmAPI = {
    get: () => api.get('/farm'),
    update: (data: Record<string, unknown>) => api.put('/farm', data),
    updateMe: (data: { name?: string; phone?: string; language?: Lang }) => api.put('/farm/me', data),
    geocode: (q: string) => api.get(`/farm/geocode?q=${encodeURIComponent(q)}`),
};

export const dashboardAPI = {
    get: (lang: Lang) => api.get(`/dashboard?lang=${lang}`),
    profit: () => api.get('/dashboard/profit'),
};

export const cropAPI = {
    getRecommendations: (data: { soilType: string; rainfall: number; season: string }) => api.post('/crop/recommend', data),
    addCrop: (data: { cropName: string; season: string; sowingDate: string; expectedHarvestDate: string; predictedYield?: number }) => api.post('/crop', data),
    getCrops: () => api.get('/crop'),
    updateCrop: (id: string, data: Record<string, unknown>) => api.put(`/crop/${id}`, data),
};

export const solarAPI = {
    getOptimization: () => api.get('/solar/optimize'),
    getHistory: (days = 30) => api.get(`/solar/history?days=${days}`),
};

export const scanAPI = {
    crop: (image: string) => api.post('/scan/crop', { image }),
    panel: (image: string) => api.post('/scan/panel', { image }),
    history: () => api.get('/disease/history'),
    updateStatus: (id: string, status: string) => api.put(`/disease/${id}`, { status }),
};

export const carbonAPI = {
    getWallet: () => api.get('/carbon/wallet'),
    withdraw: (data: { credits: number; method?: string; buyerId?: string }) => api.post('/carbon/withdraw', data),
    getHistory: (days = 90) => api.get(`/carbon/history?days=${days}`),
    getIntelligence: () => api.get('/carbon/intelligence'),
    certificate: () => api.post('/carbon/certificate'),
};

export const marketAPI = {
    getPrices: (cropName: string) => api.get(`/market/prices?cropName=${encodeURIComponent(cropName)}`),
    getTrends: (cropName: string) => api.get(`/market/trends?cropName=${encodeURIComponent(cropName)}`),
    getRecommendation: (cropName: string, quantity = 10) =>
        api.get(`/market/recommend?cropName=${encodeURIComponent(cropName)}&quantity=${quantity}`),
};

export const weatherAPI = {
    getCurrent: (lat: number, lon: number) => api.get(`/weather/current?lat=${lat}&lon=${lon}`),
    getForecast: (lat: number, lon: number) => api.get(`/weather/forecast?lat=${lat}&lon=${lon}`),
    getAlerts: (lat: number, lon: number) => api.get(`/weather/alerts?lat=${lat}&lon=${lon}`),
    getSolarRadiation: (lat: number, lon: number) => api.get(`/weather/solar-radiation?lat=${lat}&lon=${lon}`),
};

export const iotAPI = {
    latest: () => api.get('/iot/latest'),
    history: (hours = 24) => api.get(`/iot/history?hours=${hours}`),
    devices: () => api.get('/iot/devices'),
    registerDevice: (name: string, type = 'esp32') => api.post('/iot/devices', { name, type }),
    deleteDevice: (id: string) => api.delete(`/iot/devices/${id}`),
    streamUrl: () => `${API_BASE}/iot/stream?token=${encodeURIComponent(getToken() || '')}`,
};

export const assistantAPI = {
    status: () => api.get('/assistant/status'),
    chat: (data: { message?: string; audio?: { mimeType: string; data: string }; lang: Lang; history?: { role: string; text: string }[] }) =>
        api.post('/assistant/chat', data),
    tts: (text: string, lang: Lang, provider?: 'edge' | 'gemini' | 'bhashini') => api.post('/assistant/tts', { text, lang, provider }, { responseType: 'blob', timeout: 30000 }),
    briefing: (lang: Lang) => api.get(`/assistant/briefing?lang=${lang}`),
};

export const districtAPI = {
    get: (district?: string, state?: string) =>
        api.get(`/district?${new URLSearchParams({ ...(district != null ? { district } : {}), ...(state ? { state } : {}) })}`),
};

export const schemeAPI = {
    check: (answers: Record<string, unknown>) => api.post('/schemes/check', answers),
};

export const reportAPI = {
    season: () => api.get('/reports/season'),
};

export const verifyAPI = {
    certificate: (id: string) => api.get(`/carbon/verify/${encodeURIComponent(id)}`),
};

export const notificationAPI = {
    list: () => api.get('/notifications'),
    markRead: (ids?: string[]) => api.post('/notifications/read', { ids }),
    config: () => api.get('/notifications/config'),
    subscribe: (sub: PushSubscriptionJSON) => api.post('/notifications/subscribe', sub),
    prefs: (p: { push?: boolean; sms?: boolean; whatsapp?: boolean; minLevel?: string }) => api.put('/notifications/prefs', p),
    test: () => api.post('/notifications/test'),
    risk: (lang: Lang) => api.get(`/notifications/risk?lang=${lang}`),
};

export const partnerAPI = {
    myPartner: () => api.get('/epc/partner'),
    link: (code: string) => api.post('/epc/link', { code }),
    unlink: () => api.delete('/epc/link'),
    fleet: () => api.get('/epc/fleet'),
    keys: () => api.get('/epc/keys'),
    createKey: (name: string) => api.post('/epc/keys', { name }),
    updateKey: (id: string, data: { webhookUrl?: string; isActive?: boolean }) => api.put(`/epc/keys/${id}`, data),
    deleteKey: (id: string) => api.delete(`/epc/keys/${id}`),
    testWebhook: (id: string) => api.post(`/epc/keys/${id}/test`),
};

export const mrvAPI = {
    report: () => api.get('/carbon/mrv'),
    poa: (district?: string) => api.get(`/carbon/poa${district ? `?district=${encodeURIComponent(district)}` : ''}`),
};

export const marketExtraAPI = {
    report: (data: { crop: string; mandi: string; price: number; soldQty?: number }) => api.post('/market/report', data),
    status: () => api.get('/market/status'),
};

export const translateAPI = {
    items: <T extends Record<string, unknown>>(items: T, lang: Lang) => api.post('/assistant/translate', { items, lang }),
};

/** Download an authenticated file (CSV/PDF) through the API. */
export async function downloadFile(path: string, filename: string) {
    const res = await api.get(path, { responseType: 'blob', timeout: 90000 });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
