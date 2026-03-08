'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
    Zap, UserPlus, Loader2, AlertCircle, Mic, MicOff,
    User, Smartphone, Mail, Lock, MapPin, ChevronRight,
    CheckCircle2,
} from 'lucide-react';

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [district, setDistrict] = useState('');
    const [farmSize, setFarmSize] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const { register } = useAuth();
    const router = useRouter();

    const startVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            // Parse voice input to auto-fill fields
            const nameMatch = text.match(/(?:my name is|i am|name)\s+(\w+(?:\s+\w+)?)/i);
            const acreMatch = text.match(/(\d+)\s*(?:acres?|bigha)/i);
            const distMatch = text.match(/(?:from|in|at)\s+(\w+)/i);

            if (nameMatch) setName(nameMatch[1]);
            if (acreMatch) setFarmSize(acreMatch[1]);
            if (distMatch) setDistrict(distMatch[1]);
            setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register({ name, email, password, phone, district, farmSize: parseFloat(farmSize) || 0 });
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '460px', animation: 'fadeIn 0.6s ease forwards' }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem', boxShadow: '0 8px 24px rgba(52,211,153,0.3)',
                }}>
                    <Zap size={28} strokeWidth={2.5} color="#064e3b" />
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Join AgroVolt AI</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem', marginTop: '0.25rem', fontFamily: 'var(--font-body)' }}>Set up your farm intelligence in 2 minutes</p>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[1, 2, 3].map(s => (
                    <div key={s} style={{
                        flex: 1, height: '4px', borderRadius: '2px',
                        background: s <= step ? 'var(--color-green-400)' : 'rgba(255,255,255,0.2)',
                        transition: 'background 0.3s ease',
                    }} />
                ))}
            </div>

            {/* Card */}
            <div style={{
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 'var(--radius-2xl)',
                padding: '1.75rem',
                boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
            }}>
                {/* Voice Input */}
                <button
                    onClick={isListening ? () => { recognitionRef.current?.stop(); setIsListening(false); } : startVoiceInput}
                    style={{
                        width: '100%', padding: '0.75rem',
                        borderRadius: 'var(--radius-xl)',
                        border: '2px dashed var(--color-green-300)',
                        background: isListening ? 'var(--color-green-50)' : 'white',
                        color: 'var(--color-green-700)',
                        cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        marginBottom: '1.25rem',
                        fontFamily: 'var(--font-body)',
                        animation: isListening ? 'pulse-ring 1.5s ease infinite' : 'none',
                    }}
                >
                    {isListening ? <><MicOff size={16} /> Listening... say your name, farm size & district</> : <><Mic size={16} /> Tap to speak — auto-fill your details</>}
                </button>

                {error && (
                    <div style={{
                        padding: '0.75rem', background: 'var(--color-red-50)',
                        borderRadius: 'var(--radius-lg)', color: 'var(--color-red-600)',
                        fontSize: '0.8125rem', marginBottom: '1rem',
                        borderLeft: '3px solid var(--color-red-400)',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {step === 1 && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem' }}>Personal Details</h3>
                            <div style={{ marginBottom: '0.875rem' }}>
                                <label className="label">Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" placeholder="Sagar Swain" value={name} onChange={(e) => setName(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                                    <User size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '0.875rem' }}>
                                <label className="label">Phone Number</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" placeholder="+91 78945 61230" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
                                    <Smartphone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <button type="button" onClick={() => setStep(2)} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem' }}>Farm Details</h3>
                            <div style={{ marginBottom: '0.875rem' }}>
                                <label className="label">District</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" placeholder="Khordha" value={district} onChange={(e) => setDistrict(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
                                    <MapPin size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '0.875rem' }}>
                                <label className="label">Farm Size (acres)</label>
                                <input className="input" type="number" placeholder="2" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" onClick={() => setStep(1)} style={{
                                    flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--color-gray-200)', background: 'white',
                                    color: 'var(--color-gray-600)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                                }}>
                                    Back
                                </button>
                                <button type="button" onClick={() => setStep(3)} className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                                    Next <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem' }}>Account Setup</h3>
                            <div style={{ marginBottom: '0.875rem' }}>
                                <label className="label">Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" type="email" placeholder="farmer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                                    <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="label">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                                    <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" onClick={() => setStep(2)} style={{
                                    flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--color-gray-200)', background: 'white',
                                    color: 'var(--color-gray-600)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                                }}>
                                    Back
                                </button>
                                <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                                    {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><UserPlus size={16} /> Create Account</>}
                                </button>
                            </div>
                        </div>
                    )}
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.8125rem', fontFamily: 'var(--font-body)' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: 'var(--color-green-600)', fontWeight: 600, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
