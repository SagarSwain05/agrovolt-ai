'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ═══════════════════════════════════════════════
// AgroVolt AI — Hybrid Auth System
// Primary: localStorage (always works, no backend needed)
// Secondary: Backend API (when MongoDB is available)
// ═══════════════════════════════════════════════

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  district?: string;
  farmSize?: number;
  carbonBalance: number;
  language: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  district?: string;
  farmSize?: number;
  language?: string;
  farmName?: string;
  location?: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ═══ LOCAL USER STORE (localStorage-based, no MongoDB needed) ═══
const USERS_KEY = 'agrovolt_users';
const TOKEN_KEY = 'agrovolt_token';
const USER_KEY = 'agrovolt_user';

function getLocalUsers(): Record<string, { user: User; passwordHash: string }> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch { return {}; }
}

function saveLocalUsers(users: Record<string, { user: User; passwordHash: string }>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Simple hash for local storage (NOT cryptographic — just for demo)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h' + Math.abs(hash).toString(36) + str.length;
}

// Generate a fake JWT-like token
function generateLocalToken(userId: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ id: userId, iat: Date.now(), exp: Date.now() + 7 * 24 * 3600000 }));
  const sig = btoa(userId + Date.now());
  return `${header}.${payload}.${sig}`;
}

// ═══ TRY BACKEND, FALLBACK TO LOCAL ═══
async function tryBackendLogin(email: string, password: string): Promise<{ user: User; token: string } | null> {
  try {
    const res = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(3000), // 3s timeout
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // If backend says "invalid credentials", don't fallback — it means user exists on backend
      if (res.status === 401) throw new Error(data.message || 'Invalid credentials');
      return null; // Server error — fallback to local
    }
    const data = await res.json();
    const d = data.data || data;
    // Backend returns flat { _id, name, email, role, token } — normalize
    const user: User = {
      _id: d._id, name: d.name, email: d.email, role: d.role || 'farmer',
      phone: d.phone, carbonBalance: d.carbonBalance || 0, language: d.language || 'english',
      district: d.district, farmSize: d.farmSize,
    };
    return { user, token: d.token };
  } catch (err: any) {
    if (err.message === 'Invalid credentials') throw err;
    console.warn('Backend unavailable, using local auth:', err.message);
    return null;
  }
}

async function tryBackendRegister(data: RegisterData): Promise<{ user: User; token: string } | null> {
  try {
    const res = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 400) throw new Error(errData.message || 'Registration failed');
      return null;
    }
    const result = await res.json();
    const d = result.data || result;
    const user: User = {
      _id: d._id, name: d.name, email: d.email, role: d.role || 'farmer',
      phone: data.phone, carbonBalance: 0, language: data.language || 'english',
      district: data.district, farmSize: data.farmSize,
    };
    return { user, token: d.token };
  } catch (err: any) {
    if (err.message?.includes('already exists') || err.message === 'Registration failed') throw err;
    console.warn('Backend unavailable, using local auth:', err.message);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed._id) {
          setToken(savedToken);
          setUser(parsed);
        }
      }
    } catch (e) {
      // Corrupted data — clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Try backend first
    const backendResult = await tryBackendLogin(email, password);
    if (backendResult) {
      setToken(backendResult.token);
      setUser(backendResult.user);
      localStorage.setItem(TOKEN_KEY, backendResult.token);
      localStorage.setItem(USER_KEY, JSON.stringify(backendResult.user));
      return;
    }

    // Fallback: local auth
    const users = getLocalUsers();
    const entry = users[email.toLowerCase()];
    if (!entry) {
      throw new Error('No account found with this email. Please register first.');
    }
    if (entry.passwordHash !== simpleHash(password)) {
      throw new Error('Incorrect password. Please try again.');
    }
    const localToken = generateLocalToken(entry.user._id);
    setToken(localToken);
    setUser(entry.user);
    localStorage.setItem(TOKEN_KEY, localToken);
    localStorage.setItem(USER_KEY, JSON.stringify(entry.user));
  };

  const register = async (data: RegisterData) => {
    // Validate
    if (!data.name?.trim()) throw new Error('Please enter your name.');
    if (!data.email?.trim()) throw new Error('Please enter your email.');
    if (!data.password || data.password.length < 4) throw new Error('Password must be at least 4 characters.');

    const backendPayload = {
      ...data,
      farmName: data.name ? `${data.name}'s Farm` : 'My Farm',
      location: {
        district: data.district || '',
        latitude: 20.5937,
        longitude: 78.9629,
        address: '',
        state: ''
      }
    };

    // Try backend first
    const backendResult = await tryBackendRegister(backendPayload);
    if (backendResult) {
      setToken(backendResult.token);
      setUser(backendResult.user);
      localStorage.setItem(TOKEN_KEY, backendResult.token);
      localStorage.setItem(USER_KEY, JSON.stringify(backendResult.user));
      // Also save locally as backup
      const users = getLocalUsers();
      users[data.email.toLowerCase()] = { user: backendResult.user, passwordHash: simpleHash(data.password) };
      saveLocalUsers(users);
      return;
    }

    // Fallback: local registration
    const users = getLocalUsers();
    const emailKey = data.email.toLowerCase();
    if (users[emailKey]) {
      throw new Error('An account with this email already exists. Please sign in.');
    }

    const newUser: User = {
      _id: 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: data.name.trim(),
      email: emailKey,
      phone: data.phone || '',
      role: 'farmer',
      district: data.district || '',
      farmSize: data.farmSize || 0,
      carbonBalance: 0,
      language: data.language || 'english',
    };
    users[emailKey] = { user: newUser, passwordHash: simpleHash(data.password) };
    saveLocalUsers(users);

    const localToken = generateLocalToken(newUser._id);
    setToken(localToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, localToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, isAuthenticated: !!token && !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
