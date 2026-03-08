'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Zap, LogIn, Loader2, AlertCircle, Info } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '420px',
                animation: 'fadeIn 0.6s ease forwards',
            }}
        >
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem', boxShadow: '0 8px 24px rgba(52,211,153,0.3)',
                }}>
                    <Zap size={28} strokeWidth={2.5} color="#064e3b" />
                </div>
                <h1
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        color: 'white',
                        letterSpacing: '-0.02em',
                    }}
                >
                    AgroVolt AI
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.25rem', fontFamily: 'var(--font-body)' }}>
                    Cultivating Energy. Harvesting Intelligence.
                </p>
            </div>

            {/* Login Card */}
            <div
                style={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: '2rem',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <h2
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.375rem',
                        fontWeight: 700,
                        color: 'var(--color-gray-800)',
                        marginBottom: '0.25rem',
                    }}
                >
                    Welcome Back
                </h2>
                <p style={{ color: 'var(--color-gray-500)', fontSize: '0.8125rem', marginBottom: '1.5rem', fontFamily: 'var(--font-body)' }}>
                    Sign in to access your farm intelligence
                </p>

                {error && (
                    <div
                        style={{
                            padding: '0.75rem',
                            background: 'var(--color-red-50)',
                            borderRadius: 'var(--radius-lg)',
                            color: 'var(--color-red-600)',
                            fontSize: '0.8125rem',
                            marginBottom: '1rem',
                            borderLeft: '3px solid var(--color-red-400)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}
                    >
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label">Email Address</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="farmer@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                        {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : <><LogIn size={16} /> Sign In</>}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}>
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/register"
                            style={{ color: 'var(--color-green-600)', fontWeight: 600, textDecoration: 'none' }}
                        >
                            Register here
                        </Link>
                    </p>
                </div>

                {/* Demo */}
                <div
                    style={{
                        marginTop: '1.25rem',
                        padding: '0.75rem',
                        background: 'var(--color-blue-50)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: '0.75rem',
                        color: 'var(--color-blue-700)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <Info size={14} style={{ flexShrink: 0 }} />
                    <span><strong>Demo:</strong> Register a new account or use any existing credentials to explore the platform.</span>
                </div>
            </div>
        </div>
    );
}
