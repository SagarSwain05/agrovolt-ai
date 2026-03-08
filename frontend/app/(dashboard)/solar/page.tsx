'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import {
    Zap, BarChart3, Wrench, IndianRupee, TrendingUp,
    Sun, CloudSun, CloudRain, Wind, Thermometer, CheckCircle2,
    AlertTriangle, RotateCw, Cable, Droplets, CircleDot,
} from 'lucide-react';

export default function SolarPage() {
    const currentTilt = 35;
    const optimalTilt = 28;
    const efficiencyGain = 8;

    const panelChecks = [
        { label: 'Dust Level', status: 'Clean', icon: <Droplets size={18} color="var(--color-blue-500)" />, badge: 'badge-green' },
        { label: 'Surface Cracks', status: 'None', icon: <CircleDot size={18} color="var(--color-gray-400)" />, badge: 'badge-green' },
        { label: 'Temperature', status: '42°C', icon: <Thermometer size={18} color="var(--color-solar-500)" />, badge: 'badge-solar', note: 'Bio-cooling active (-3°C)' },
        { label: 'Wiring', status: 'Secure', icon: <Cable size={18} color="var(--color-gray-500)" />, badge: 'badge-green' },
        { label: 'Output Drop', status: '0%', icon: <AlertTriangle size={18} color="var(--color-green-500)" />, badge: 'badge-green', note: 'Performing at rated capacity' },
    ];

    const forecast = [
        { day: 'Mon', kwh: 24, icon: <Sun size={16} color="var(--color-solar-500)" /> },
        { day: 'Tue', kwh: 26, icon: <Sun size={16} color="var(--color-solar-500)" /> },
        { day: 'Wed', kwh: 18, icon: <CloudSun size={16} color="var(--color-gray-400)" /> },
        { day: 'Thu', kwh: 12, icon: <CloudRain size={16} color="var(--color-blue-400)" /> },
        { day: 'Fri', kwh: 22, icon: <Sun size={16} color="var(--color-solar-500)" /> },
        { day: 'Sat', kwh: 25, icon: <Sun size={16} color="var(--color-solar-500)" /> },
        { day: 'Sun', kwh: 20, icon: <Wind size={16} color="var(--color-gray-400)" /> },
    ];
    const maxKwh = Math.max(...forecast.map(d => d.kwh));

    return (
        <div>
            <Navbar title="Solar Optimization" subtitle="Maximize panel efficiency with AI-driven tilt guidance & bio-cooling" />

            <div className="page-container">
                {/* Stats */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <StatCard icon={<Zap size={20} strokeWidth={1.75} />} label="Energy Today" value="24.5 kWh" trend="up" trendValue="+12%" variant="solar" />
                    <StatCard icon={<BarChart3 size={20} strokeWidth={1.75} />} label="Panel Efficiency" value="87%" subValue="↑3% bio-cooling" variant="green" />
                    <StatCard icon={<Wrench size={20} strokeWidth={1.75} />} label="Panel Count" value="12" subValue="5 kW capacity" variant="default" />
                    <StatCard icon={<IndianRupee size={20} strokeWidth={1.75} />} label="Revenue Today" value="₹147" subValue="₹6/kWh" variant="green" />
                </div>

                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* AR Tilt Optimizer */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <RotateCw size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                            AR Tilt Optimizer
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1.25rem' }}>
                            Manual tilt guide — eliminates ₹50,000 auto-tracking motors
                        </p>

                        {/* Visual Tilt Guide */}
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '220px',
                            background: 'linear-gradient(180deg, #e0f2fe 0%, #f0fdf4 100%)',
                            borderRadius: 'var(--radius-xl)',
                            overflow: 'hidden',
                            marginBottom: '0.75rem',
                        }}>
                            {/* Sun */}
                            <div style={{ position: 'absolute', top: '25px', right: '30%', animation: 'float 4s ease-in-out infinite' }}>
                                <Sun size={36} color="var(--color-solar-400)" fill="var(--color-solar-300)" />
                            </div>

                            {/* Panel Line */}
                            <svg viewBox="0 0 400 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                                <line x1="100" y1="160" x2="300" y2={160 - Math.tan((optimalTilt * Math.PI) / 180) * 200} stroke="var(--color-green-600)" strokeWidth="4" strokeLinecap="round" />
                                <line x1="100" y1="160" x2="100" y2="40" stroke="var(--color-gray-300)" strokeWidth="1" strokeDasharray="4" />
                            </svg>

                            {/* Tilt Labels */}
                            <div style={{
                                position: 'absolute',
                                bottom: '12px',
                                left: 0,
                                right: 0,
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '2rem',
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Current Tilt</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-gray-700)' }}>{currentTilt}°</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-green-600)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Optimal Tilt</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-green-600)' }}>{optimalTilt}°</div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '0.75rem',
                            background: 'var(--color-solar-50)',
                            borderRadius: 'var(--radius-lg)',
                            borderLeft: '3px solid var(--color-solar-400)',
                            fontSize: '0.8125rem',
                            color: 'var(--color-gray-700)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}>
                            <Zap size={16} color="var(--color-solar-600)" />
                            <span>
                                Adjust tilt to <strong>{optimalTilt}°</strong> for an estimated <strong style={{ color: 'var(--color-green-600)' }}>+{efficiencyGain}% efficiency gain</strong>.
                                Use your phone's gyroscope for AR alignment.
                            </span>
                        </div>
                    </div>

                    {/* Panel Health Monitor */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            Panel Health Monitor
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1rem' }}>AI-powered dust & crack detection</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {panelChecks.map((check, i) => (
                                <div key={check.label} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.625rem 0.75rem',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--color-gray-50)',
                                    animation: `fadeIn 0.3s ease ${i * 0.05}s forwards`,
                                    animationFillMode: 'backwards',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                        {check.icon}
                                        <div>
                                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-gray-700)' }}>{check.label}</div>
                                            {check.note && <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>{check.note}</div>}
                                        </div>
                                    </div>
                                    <span className={`badge ${check.badge}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                                        {check.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 7-Day Energy Forecast */}
                <div className="card">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                        7-Day Energy Forecast
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1.25rem' }}>Predicted daily output with weather integration</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem', alignItems: 'end' }}>
                        {forecast.map((d, i) => (
                            <div key={d.day} style={{
                                textAlign: 'center',
                                animation: `fadeIn 0.3s ease ${i * 0.06}s forwards`,
                                animationFillMode: 'backwards',
                            }}>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-gray-700)', marginBottom: '0.375rem', fontFamily: 'var(--font-mono)' }}>
                                    {d.kwh} kWh
                                </div>
                                <div style={{
                                    height: `${(d.kwh / maxKwh) * 140}px`,
                                    borderRadius: 'var(--radius-lg)',
                                    background: d.kwh >= 22
                                        ? 'linear-gradient(to top, var(--color-solar-500), var(--color-solar-300))'
                                        : d.kwh >= 15
                                            ? 'linear-gradient(to top, var(--color-solar-400), var(--color-solar-200))'
                                            : 'linear-gradient(to top, var(--color-gray-300), var(--color-gray-200))',
                                    transition: 'height 0.5s ease',
                                }} />
                                <div style={{ marginTop: '0.5rem' }}>{d.icon}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-500)' }}>{d.day}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
