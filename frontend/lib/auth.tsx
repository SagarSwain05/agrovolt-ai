'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authAPI, apiError, wakeBackend, TOKEN_KEY, USER_KEY, type Lang } from './api';

// ═══════════════════════════════════════════════
// AgroVolt AI — Auth (backend JWT only)
// The session is cached in localStorage for instant reloads and re-validated
// against /api/auth/me in the background.
// ═══════════════════════════════════════════════

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  language: Lang;
  farmId?: string;
  partnerCode?: string;
  organization?: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  district?: string;
  state?: string;
  farmSize?: number;
  language?: Lang;
  latitude?: number;
  longitude?: number;
  role?: 'farmer' | 'epc' | 'fpo';
  organization?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  /** true while a request is waiting on a sleeping backend */
  waking: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(d: Record<string, unknown>): User {
  const lang = String(d.language || 'en');
  return {
    _id: String(d._id),
    name: String(d.name || ''),
    email: String(d.email || ''),
    phone: d.phone ? String(d.phone) : undefined,
    role: String(d.role || 'farmer'),
    language: (lang.startsWith('hi') ? 'hi' : lang.startsWith('or') || lang.startsWith('od') ? 'or' : 'en') as Lang,
    partnerCode: d.partnerCode ? String(d.partnerCode) : undefined,
    organization: d.organization ? String(d.organization) : undefined,
    farmId: d.farmId && typeof d.farmId === 'object' ? String((d.farmId as { _id: string })._id) : d.farmId ? String(d.farmId) : undefined,
  };
}

function persist(token: string | null, user: User | null) {
  try {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch { /* storage unavailable (private mode) */ }
}

/** Run a request; flip `waking` on if it takes longer than a normal round-trip. */
async function withWake<T>(setWaking: (v: boolean) => void, fn: () => Promise<T>): Promise<T> {
  const timer = setTimeout(() => setWaking(true), 4000);
  try {
    return await fn();
  } finally {
    clearTimeout(timer);
    setWaking(false);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    wakeBackend();
    let savedToken: string | null = null;
    try {
      savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(normalizeUser(JSON.parse(savedUser)));
      }
    } catch {
      persist(null, null);
    }
    setLoading(false);

    // Re-validate in the background; a 401 is handled by the api interceptor.
    if (savedToken) {
      authAPI.getMe()
        .then((res) => {
          // Ignore if the session changed (logout / another login) while this was in flight
          let current: string | null = null;
          try { current = localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
          if (current !== savedToken) return;
          const u = normalizeUser(res.data.data);
          setUser(u);
          persist(savedToken, u);
        })
        .catch(() => { /* offline or cold start — keep cached session */ });
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await withWake(setWaking, () => authAPI.login(email.trim(), password));
      const d = res.data.data;
      const u = normalizeUser(d);
      setToken(d.token);
      setUser(u);
      persist(d.token, u);
    } catch (e) {
      throw new Error(apiError(e, 'Login failed'));
    }
  };

  const register = async (data: RegisterData) => {
    if (!data.name?.trim()) throw new Error('Please enter your name.');
    if (!data.email?.trim()) throw new Error('Please enter your email.');
    if (!data.password || data.password.length < 6) throw new Error('Password must be at least 6 characters.');
    try {
      const res = await withWake(setWaking, () => authAPI.register({
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        phone: data.phone,
        language: data.language || 'en',
        role: data.role || 'farmer',
        organization: data.organization,
        farmName: `${data.name.trim()}'s Farm`,
        farmSize: data.farmSize || 2,
        district: data.district,
        state: data.state || 'Odisha',
        location: {
          district: data.district || '',
          state: data.state || 'Odisha',
          ...(data.latitude && data.longitude ? { latitude: data.latitude, longitude: data.longitude } : {}),
        },
      }));
      const d = res.data.data;
      const u = normalizeUser(d);
      setToken(d.token);
      setUser(u);
      persist(d.token, u);
    } catch (e) {
      throw new Error(apiError(e, 'Registration failed'));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    persist(null, null);
    try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_DATA' }); } catch { /* no SW */ }
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, waking, login, register, logout, updateUser, isAuthenticated: !!token && !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
