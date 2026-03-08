'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import {
    Zap, Droplets, Leaf, IndianRupee, ScanLine, BarChart3,
    Sun, Wallet, CheckCircle2, ArrowRight, CloudSun,
    Thermometer, Wind, TrendingUp, Activity, Sprout, ShieldCheck,
    BrainCircuit, MessageSquareText,
} from 'lucide-react';

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [briefingVisible, setBriefingVisible] = useState(false);
    const [briefingText, setBriefingText] = useState('');

    const fullBriefing = "Good morning, Sagar. Today's forecast: partly cloudy, 28°C with 65% humidity — no rain expected. Your panels are generating peak power at 87% efficiency. The tomato section needs irrigation at 6 AM (reduced 25% due to panel shade savings). Turmeric prices at Khordha Mandi are up 5.2% — I recommend holding for 3 more days. Your carbon credits have reached 0.82 — consider selling to Tata Group at ₹1,800/credit.";

    useEffect(() => {
        setTimeout(() => setLoading(false), 600);
        setTimeout(() => setBriefingVisible(true), 800);
    }, []);

    useEffect(() => {
        if (briefingVisible) {
            let i = 0;
            const interval = setInterval(() => {
                if (i <= fullBriefing.length) {
                    setBriefingText(fullBriefing.slice(0, i));
                    i++;
                } else {
                    clearInterval(interval);
                }
            }, 18);
            return () => clearInterval(interval);
        }
    }, [briefingVisible]);

    if (loading) {
        return (
            <div>
                <Navbar title="Dashboard" subtitle="Your agrivoltaic farm intelligence — One View" />
                <div className="page-container">
                    <div className="grid-4">
                        {[1, 2, 3, 4].map(i => (<div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-xl)' }} />))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navbar title="Dashboard" subtitle="Your agrivoltaic farm intelligence — One View" />

            <div className="page-container">
                {/* AI Morning Briefing */}
                {briefingVisible && (
                    <div style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-xl)',
                        background: 'linear-gradient(135deg, var(--color-green-800), var(--color-green-900))',
                        color: 'white',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        animation: 'fadeIn 0.5s ease forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <BrainCircuit size={18} strokeWidth={1.75} />
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
                                AI Morning Briefing
                            </span>
                            <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)', background: 'rgba(52,211,153,0.2)', color: '#6ee7b7', fontWeight: 600 }}>
                                LIVE
                            </span>
                        </div>
                        <p style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.875rem',
                            lineHeight: 1.7,
                            opacity: 0.9,
                        }}>
                            {briefingText}<span style={{ animation: 'pulse-ring 1s ease infinite', opacity: briefingText.length < fullBriefing.length ? 1 : 0 }}>|</span>
                        </p>
                    </div>
                )}

                {/* Stat Cards */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <StatCard icon={<Zap size={20} strokeWidth={1.75} />} label="Solar Energy" value="24.5 kWh" trend="up" trendValue="+12%" variant="solar" />
                    <StatCard icon={<Droplets size={20} strokeWidth={1.75} />} label="Water Saved" value="1,200 L" subValue="25% saved by shade" variant="blue" />
                    <StatCard icon={<Leaf size={20} strokeWidth={1.75} />} label="Carbon Credits" value="0.82" subValue="≈ ₹1,230" variant="green" />
                    <StatCard icon={<IndianRupee size={20} strokeWidth={1.75} />} label="Projected Revenue" value="₹18,500" subValue="This month" variant="green" />
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                        { href: '/scan', icon: <ScanLine size={16} />, label: 'Scan Disease', color: 'var(--color-green-600)' },
                        { href: '/market', icon: <BarChart3 size={16} />, label: 'Market Prices', color: 'var(--color-blue-600)' },
                        { href: '/solar', icon: <Zap size={16} />, label: 'Solar Status', color: 'var(--color-solar-600)' },
                        { href: '/carbon', icon: <Wallet size={16} />, label: 'Carbon Wallet', color: 'var(--color-green-700)' },
                    ].map(action => (
                        <a
                            key={action.label}
                            href={action.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.625rem 1rem',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid var(--color-gray-200)',
                                background: 'white',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                color: action.color,
                                textDecoration: 'none',
                                fontFamily: 'var(--font-body)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {action.icon}
                            {action.label}
                        </a>
                    ))}
                </div>

                {/* Split View — Crop Actions + Solar Status */}
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* Crop Actions */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Sprout size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                                    Today&apos;s Crop Actions
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>AI-generated daily task list</p>
                            </div>
                            <a href="/crops" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-green-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-body)' }}>
                                View All <ArrowRight size={12} />
                            </a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {[
                                { time: '6:00 AM', task: 'Irrigate tomato section (reduced 25% — panel shade saving)', done: true, icon: <Droplets size={16} color="var(--color-blue-500)" /> },
                                { time: '8:00 AM', task: 'Apply neem oil spray — preventive for leaf curl', done: false, icon: <ShieldCheck size={16} color="var(--color-green-500)" /> },
                                { time: '10:00 AM', task: 'Check growth stage of turmeric (Day 45)', done: false, icon: <Activity size={16} color="var(--color-solar-500)" /> },
                                { time: '2:00 PM', task: 'Harvest spinach batch — optimal market window', done: false, icon: <Sprout size={16} color="var(--color-green-600)" /> },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.625rem 0.75rem',
                                    borderRadius: 'var(--radius-lg)',
                                    background: item.done ? 'var(--color-gray-50)' : 'white',
                                    border: '1px solid var(--color-gray-100)',
                                }}>
                                    {item.icon}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8125rem', color: item.done ? 'var(--color-gray-400)' : 'var(--color-gray-700)', textDecoration: item.done ? 'line-through' : 'none', fontWeight: 500 }}>
                                            {item.task}
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', fontFamily: 'var(--font-mono)' }}>{item.time}</div>
                                    </div>
                                    {item.done && <CheckCircle2 size={16} color="var(--color-green-500)" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Solar Status */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Zap size={20} strokeWidth={1.75} color="var(--color-solar-500)" />
                                    Today&apos;s Solar Status
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>Real-time panel intelligence</p>
                            </div>
                            <a href="/solar" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-solar-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-body)' }}>
                                Details <ArrowRight size={12} />
                            </a>
                        </div>

                        {/* Efficiency Gauge */}
                        <div style={{
                            textAlign: 'center', padding: '1.25rem',
                            background: 'linear-gradient(135deg, var(--color-green-50), var(--color-solar-50))',
                            borderRadius: 'var(--radius-xl)', marginBottom: '0.75rem',
                        }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: 'var(--color-green-700)', letterSpacing: '-0.03em' }}>
                                87%
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', fontWeight: 500 }}>Panel Efficiency</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-green-600)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                <TrendingUp size={14} /> 3% from bio-cooling effect
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {[
                                { label: 'Panel efficiency at 87% — optimal range', icon: <CheckCircle2 size={16} color="var(--color-green-500)" /> },
                                { label: 'Tilt at 35° — adjust to 28° for +8% gain', icon: <TrendingUp size={16} color="var(--color-solar-500)" /> },
                                { label: 'Bio-cooling active — crops reducing panel temp by 3°C', icon: <Thermometer size={16} color="var(--color-blue-500)" /> },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--color-gray-50)',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-gray-600)',
                                }}>
                                    {item.icon}
                                    {item.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Weekly Forecast */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BrainCircuit size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                        AI Weekly Forecast
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1.25rem' }}>Combined crop + solar + market prediction</p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem', alignItems: 'end' }}>
                        {[
                            { day: 'Mon', val: 82, weather: <Sun size={14} /> },
                            { day: 'Tue', val: 90, weather: <Sun size={14} /> },
                            { day: 'Wed', val: 75, weather: <CloudSun size={14} /> },
                            { day: 'Thu', val: 60, weather: <Wind size={14} /> },
                            { day: 'Fri', val: 85, weather: <Sun size={14} /> },
                            { day: 'Sat', val: 92, weather: <Sun size={14} /> },
                            { day: 'Sun', val: 78, weather: <CloudSun size={14} /> },
                        ].map((d, i) => (
                            <div key={d.day} style={{ textAlign: 'center', animation: `fadeIn 0.3s ease ${i * 0.05}s forwards`, animationFillMode: 'backwards' }}>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: '0.375rem', fontFamily: 'var(--font-mono)' }}>
                                    {d.val}%
                                </div>
                                <div style={{
                                    height: `${d.val * 1.5}px`,
                                    borderRadius: 'var(--radius-lg)',
                                    background: d.val >= 85 ? 'linear-gradient(to top, var(--color-green-500), var(--color-green-400))' : d.val >= 70 ? 'linear-gradient(to top, var(--color-solar-500), var(--color-solar-300))' : 'linear-gradient(to top, var(--color-gray-400), var(--color-gray-300))',
                                    transition: 'height 0.5s ease',
                                }} />
                                <div style={{ color: 'var(--color-gray-400)', marginTop: '0.5rem' }}>{d.weather}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-500)', marginTop: '0.125rem' }}>{d.day}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Widgets */}
                <div className="grid-3">
                    {/* Weather */}
                    <div className="card">
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <CloudSun size={18} color="var(--color-solar-500)" /> Weather
                        </h4>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-gray-800)', letterSpacing: '-0.02em' }}>28°C</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)', marginBottom: '0.5rem' }}>Partly cloudy</div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Droplets size={12} /> 65%</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Wind size={12} /> 12 km/h</span>
                        </div>
                    </div>

                    {/* Market Pulse */}
                    <div className="card">
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <BarChart3 size={18} color="var(--color-blue-600)" /> Market Pulse
                        </h4>
                        {[
                            { crop: 'Tomato', price: '₹2,650/q', trend: '+5.2%' },
                            { crop: 'Turmeric', price: '₹8,200/q', trend: '+2.1%' },
                            { crop: 'Rice', price: '₹1,890/q', trend: '-0.8%' },
                        ].map(item => (
                            <div key={item.crop} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', fontSize: '0.8125rem', borderBottom: '1px solid var(--color-gray-100)' }}>
                                <span style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>{item.crop}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-gray-800)' }}>{item.price}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: item.trend.startsWith('+') ? 'var(--color-green-600)' : 'var(--color-red-500)', fontSize: '0.75rem' }}>{item.trend}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Crop Health */}
                    <div className="card">
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <Activity size={18} color="var(--color-green-600)" /> Crop Health
                        </h4>
                        {[
                            { crop: 'Tomato', status: 'Healthy', pct: 92 },
                            { crop: 'Turmeric', status: 'Monitor', pct: 78 },
                            { crop: 'Spinach', status: 'Healthy', pct: 95 },
                        ].map(item => (
                            <div key={item.crop} style={{ marginBottom: '0.625rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                                    <span style={{ color: 'var(--color-gray-700)', fontWeight: 500 }}>{item.crop}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: item.pct > 85 ? 'var(--color-green-600)' : 'var(--color-solar-600)' }}>{item.pct}%</span>
                                </div>
                                <div style={{ height: '4px', background: 'var(--color-gray-100)', borderRadius: '2px' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${item.pct}%`,
                                        borderRadius: '2px',
                                        background: item.pct > 85 ? 'var(--color-green-500)' : 'var(--color-solar-400)',
                                        transition: 'width 0.5s ease',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
