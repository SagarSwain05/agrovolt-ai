'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import {
    FileText, BrainCircuit, Thermometer, CloudRain, Sun, Wind,
    Droplets, AlertTriangle, CheckCircle2, TrendingUp, Shield,
    Zap, Leaf, Target, BarChart3,
} from 'lucide-react';

export default function ReportsPage() {
    return (
        <div>
            <Navbar title="AI Reports" subtitle="Data-driven pre-season analysis & crop intelligence" />

            <div className="page-container">
                {/* Report Header */}
                <div style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-2xl)',
                    background: 'linear-gradient(135deg, var(--color-green-800), var(--color-green-900))',
                    color: 'white',
                    marginBottom: '1.5rem',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <FileText size={20} />
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>Pre-Season Intelligence Report</span>
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                        Kharif 2026 — Comprehensive Analysis
                    </h2>
                    <p style={{ fontSize: '0.8125rem', opacity: 0.7 }}>
                        Generated on March 8, 2026 • Khordha District, Odisha
                    </p>
                </div>

                {/* Climate Risk Assessment */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                        Climate Risk Assessment
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1rem' }}>Based on NASA POWER + IMD historical data</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                        {[
                            { label: 'Avg. Temperature', value: '32.4°C', trend: '↑ 1.2°C', risk: 'Medium', icon: <Thermometer size={18} color="var(--color-solar-500)" /> },
                            { label: 'Monsoon Onset', value: 'June 12', trend: '3 days early', risk: 'Low', icon: <CloudRain size={18} color="var(--color-blue-500)" /> },
                            { label: 'Rainfall Prediction', value: '1,240 mm', trend: '+8% vs avg', risk: 'Low', icon: <Droplets size={18} color="var(--color-blue-600)" /> },
                            { label: 'Cyclone Risk', value: 'Moderate', trend: '15% probability', risk: 'High', icon: <Wind size={18} color="var(--color-red-400)" /> },
                        ].map(item => (
                            <div key={item.label} style={{
                                padding: '0.875rem',
                                borderRadius: 'var(--radius-xl)',
                                background: 'var(--color-gray-50)',
                                border: '1px solid var(--color-gray-100)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                                    {item.icon}
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', fontWeight: 500 }}>{item.label}</span>
                                </div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{item.value}</div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', marginTop: '0.125rem', fontFamily: 'var(--font-mono)' }}>{item.trend}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Crop Recommendations */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BrainCircuit size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                        AI Crop Recommendations
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1rem' }}>XGBoost model trained on 10 years of state-level yield data</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {[
                            { crop: 'Ginger', score: 92, yield: '15 Quintals/acre', revenue: '₹6.2L', risk: 'Low', reason: '92% success rate under 40% panel shade. Disease-resistant variety available.' },
                            { crop: 'Turmeric', score: 88, yield: '12 Quintals/acre', revenue: '₹5.0L', risk: 'Low', reason: 'Best shade tolerance. Intercrop with ginger for optimal land use.' },
                            { crop: 'Spinach (Multi-cut)', score: 85, yield: '180 Quintals/acre', revenue: '₹3.6L', risk: 'Medium', reason: 'Quick harvest cycles (45 days). Needs consistent irrigation.' },
                        ].map((crop, i) => (
                            <div key={crop.crop} style={{
                                padding: '1rem',
                                borderRadius: 'var(--radius-xl)',
                                border: i === 0 ? '2px solid var(--color-green-300)' : '1px solid var(--color-gray-100)',
                                background: i === 0 ? 'var(--color-green-50)' : 'white',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{crop.crop}</span>
                                        {i === 0 && <span className="badge badge-green">Recommended</span>}
                                    </div>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-green-600)' }}>{crop.score}%</span>
                                </div>
                                <div style={{ height: '4px', background: 'var(--color-gray-100)', borderRadius: '2px', marginBottom: '0.5rem' }}>
                                    <div style={{ height: '100%', width: `${crop.score}%`, borderRadius: '2px', background: 'var(--color-green-500)' }} />
                                </div>
                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', marginBottom: '0.5rem', lineHeight: 1.5 }}>{crop.reason}</p>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Target size={11} /> Yield: {crop.yield}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><TrendingUp size={11} /> Revenue: {crop.revenue}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Shield size={11} /> Risk: {crop.risk}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bio-Solar Symbiosis */}
                <div className="card">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                        Bio-Solar Symbiosis Analysis
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        {[
                            { title: 'Panel Cooling Effect', value: '-3.2°C', desc: 'Crop transpiration reduces panel temperature, boosting efficiency by 3%', icon: <Thermometer size={20} color="var(--color-blue-500)" />, bg: 'var(--color-blue-50)' },
                            { title: 'Shade Utilization', value: '85%', desc: 'Shade-tolerant crops maximize land use under panels during peak sun hours', icon: <Sun size={20} color="var(--color-solar-500)" />, bg: 'var(--color-solar-50)' },
                            { title: 'Water Efficiency', value: '+25%', desc: 'Panel shade reduces evaporation, saving 1,200L water per day on average', icon: <Droplets size={20} color="var(--color-green-600)" />, bg: 'var(--color-green-50)' },
                        ].map(item => (
                            <div key={item.title} style={{
                                padding: '1.25rem',
                                borderRadius: 'var(--radius-xl)',
                                background: item.bg,
                                textAlign: 'center',
                            }}>
                                <div style={{ margin: '0 auto 0.5rem', width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                                    {item.icon}
                                </div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-gray-800)', letterSpacing: '-0.02em' }}>
                                    {item.value}
                                </div>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '0.25rem' }}>{item.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', lineHeight: 1.5 }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
