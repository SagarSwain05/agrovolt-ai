import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('agrovolt_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('agrovolt_token');
                localStorage.removeItem('agrovolt_user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

// ============================================
// API Service Functions (Flutter-compatible REST)
// ============================================

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    register: (data: { name: string; email: string; password: string; phone?: string }) =>
        api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
};

export const dashboardAPI = {
    getData: () => api.get('/dashboard'),
};

export const cropAPI = {
    getRecommendations: (data: { soilType: string; rainfall: number; season: string }) =>
        api.post('/crop/recommend', data),
    addCrop: (data: { cropName: string; season: string; sowingDate: string; expectedHarvestDate?: string }) =>
        api.post('/crop', data),
    getCrops: () => api.get('/crop'),
    updateCrop: (id: string, data: Record<string, unknown>) =>
        api.put(`/crop/${id}`, data),
};

export const solarAPI = {
    getOptimization: () => api.get('/solar/optimize'),
    addData: (data: { energyProduced: number; efficiency?: number; dustLevel?: string }) =>
        api.post('/solar/data', data),
    getHistory: (days?: number) => api.get(`/solar/history?days=${days || 30}`),
};

export const diseaseAPI = {
    scan: (formData: FormData) =>
        api.post('/disease/scan', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    getHistory: () => api.get('/disease/history'),
    updateStatus: (id: string, status: string) =>
        api.put(`/disease/${id}`, { status }),
};

export const carbonAPI = {
    getWallet: () => api.get('/carbon/wallet'),
    calculate: (data: { energyKWh: number; waterLiters: number; description?: string }) =>
        api.post('/carbon/calculate', data),
    withdraw: (data: { credits: number; method?: string }) =>
        api.post('/carbon/withdraw', data),
    getHistory: (days?: number) => api.get(`/carbon/history?days=${days || 90}`),
};

export const marketAPI = {
    getPrices: (cropName?: string) => api.get(`/market/prices?cropName=${cropName || 'Tomato'}`),
    getTrends: (cropName?: string, days?: number) =>
        api.get(`/market/trends?cropName=${cropName || 'Tomato'}&days=${days || 30}`),
    getRecommendation: (cropName?: string, quantity?: number) =>
        api.get(`/market/recommend?cropName=${cropName || 'Tomato'}&quantity=${quantity || 10}`),
};

export const weatherAPI = {
    getCurrent: (lat?: number, lon?: number) =>
        api.get(`/weather/current?lat=${lat || 20.29}&lon=${lon || 85.82}`),
    getForecast: (lat?: number, lon?: number) =>
        api.get(`/weather/forecast?lat=${lat || 20.29}&lon=${lon || 85.82}`),
    getAlerts: () => api.get('/weather/alerts'),
};
