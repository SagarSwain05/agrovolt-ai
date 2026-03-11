'use client';

import React, { useState, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import {
    IndianRupee, Wheat, Zap, Leaf, TrendingUp, TrendingDown,
    PiggyBank, Calculator, Target, CalendarDays, ArrowUpRight,
    Lightbulb, Sliders, SlidersHorizontal, CreditCard, ShieldCheck,
    Minus, Plus, ToggleLeft, ToggleRight, Brain, Sparkles,
    Fuel, Droplets, Package, Wrench, BadgeCheck, Landmark,
    ChevronRight, BarChart3, CircleDollarSign, Activity,
} from 'lucide-react';

// ══════════ MONTHLY DATA — REVENUE + EXPENSES ══════════
const ACTUAL_MONTHS = [
    { month: 'Oct', crop: 12000, solar: 2500, carbon: 1500, expenses: 8200 },
    { month: 'Nov', crop: 14000, solar: 3200, carbon: 2600, expenses: 9100 },
    { month: 'Dec', crop: 5000, solar: 4000, carbon: 2500, expenses: 7500 },
    { month: 'Jan', crop: 16000, solar: 4500, carbon: 2800, expenses: 8800 },
    { month: 'Feb', crop: 18000, solar: 5200, carbon: 4500, expenses: 9400 },
    { month: 'Mar', crop: 15000, solar: 4800, carbon: 4300, expenses: 8600 },
];

// AI Projected months (ghost bars)
const PROJECTED_MONTHS = [
    { month: 'Apr', crop: 17000, solar: 5500, carbon: 4800, expenses: 9200, projected: true },
    { month: 'May', crop: 19500, solar: 6200, carbon: 5100, expenses: 9600, projected: true },
    { month: 'Jun', crop: 16000, solar: 6800, carbon: 5500, expenses: 9000, projected: true },
];

// Expense breakdown
const EXPENSE_ITEMS = [
    { label: 'Fertilizer & Seeds', icon: <Package size={14} />, monthly: 3200, color: '#EF4444' },
    { label: 'Diesel & Labor', icon: <Fuel size={14} />, monthly: 2800, color: '#F97316' },
    { label: 'Water & Irrigation', icon: <Droplets size={14} />, monthly: 1500, color: '#3B82F6' },
    { label: 'Panel Maintenance', icon: <Wrench size={14} />, monthly: 1100, color: '#8B5CF6' },
];

// AI Insights
const AI_INSIGHTS = [
    { text: 'Your December crop income dipped by 65% due to off-season harvest, but Solar Revenue remained steady at ₹4,000 — acting as a perfect financial cushion. AgroVolt\'s dual-income model prevented a ₹7,000 income loss.', type: 'insight' },
    { text: 'Projected high sun exposure in May-June will boost solar revenue by an estimated ₹2,100/month (+38%). Consider adding panel cleaning to maximize output during peak irradiance.', type: 'forecast' },
    { text: 'Your carbon credit income grew 187% from Oct to Feb (₹1,500 → ₹4,500). At this trajectory, annual carbon revenue alone could reach ₹48,000 — enough to cover 47% of input costs.', type: 'growth' },
    { text: 'Input cost ratio improved from 51% (Oct) to 35% (Feb), indicating increasing farm efficiency. AI recommends maintaining current fertilizer mix — NPK ratio is optimal for your soil type.', type: 'efficiency' },
];

export default function ProfitPage() {
    // ROI Simulator state
    const [extraPanels, setExtraPanels] = useState(0);
    const [cropSwitch, setCropSwitch] = useState(false); // false=Rice, true=Turmeric
    const [insightIndex, setInsightIndex] = useState(0);

    const allMonths = [...ACTUAL_MONTHS.map(m => ({ ...m, projected: false })), ...PROJECTED_MONTHS];
    const maxTotal = Math.max(...allMonths.map(m => m.crop + m.solar + m.carbon));

    // Actual totals (6 months)
    const totalRevenue = ACTUAL_MONTHS.reduce((s, m) => s + m.crop + m.solar + m.carbon, 0);
    const totalExpenses = ACTUAL_MONTHS.reduce((s, m) => s + m.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    const totalCrop = ACTUAL_MONTHS.reduce((s, m) => s + m.crop, 0);
    const totalSolar = ACTUAL_MONTHS.reduce((s, m) => s + m.solar, 0);
    const totalCarbon = ACTUAL_MONTHS.reduce((s, m) => s + m.carbon, 0);
    const profitMargin = Math.round((netProfit / totalRevenue) * 100);

    // ROI simulator calculations
    const baseAnnualIncome = 480000;
    const panelBoost = extraPanels * 18000; // ₹18K/year per extra panel
    const cropSwitchBoost = cropSwitch ? 32000 : 0; // Turmeric yields ₹32K more than Rice/acre
    const simulatedIncome = baseAnnualIncome + panelBoost + cropSwitchBoost;

    // AI Credit Score
    const creditScore = useMemo(() => {
        const base = 650;
        const dualIncomeBonus = 45; // dual income = stability
        const solarBonus = Math.min(totalSolar / 1000, 30);
        const marginBonus = profitMargin > 40 ? 25 : profitMargin > 30 ? 15 : 5;
        const score = Math.min(base + dualIncomeBonus + solarBonus + marginBonus, 820);
        return Math.round(score);
    }, [totalSolar, profitMargin]);

    const loanEligibility = creditScore >= 720 ? 150000 : creditScore >= 680 ? 100000 : 50000;

    return (
        <div>
            <Navbar title="Profit Tracker" subtitle="True profit analytics — Revenue vs Input Costs · AI Forecasting · ROI Simulator · Credit Readiness" />

            <div className="page-container">
                {/* ══════ STAT CARDS — Revenue + Expenses + Net Profit ══════ */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <StatCard icon={<IndianRupee size={20} strokeWidth={1.75} />} label="Gross Revenue (6mo)" value={`₹${(totalRevenue / 1000).toFixed(1)}K`} trend="up" trendValue="+18%" variant="green" />
                    <StatCard icon={<Minus size={20} strokeWidth={1.75} />} label="Total Input Costs" value={`₹${(totalExpenses / 1000).toFixed(1)}K`} subValue={`${Math.round((totalExpenses / totalRevenue) * 100)}% of revenue`} variant="default" />
                    <StatCard icon={<TrendingUp size={20} strokeWidth={1.75} />} label="Net Profit" value={`₹${(netProfit / 1000).toFixed(1)}K`} trend="up" trendValue={`${profitMargin}% margin`} variant="green" />
                    <StatCard icon={<Leaf size={20} strokeWidth={1.75} />} label="Carbon Credits" value={`₹${(totalCarbon / 1000).toFixed(1)}K`} subValue={`${Math.round((totalCarbon / totalRevenue) * 100)}% of total`} variant="green" />
                </div>

                {/* ══════ AI FINANCIAL INSIGHTS PANEL ══════ */}
                <div className="card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5, #F0FDFA)', border: '1px solid var(--color-green-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-green-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Brain size={18} color="var(--color-green-600)" /> AI Financial Insights
                        </h3>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {AI_INSIGHTS.map((_, i) => (
                                <button key={i} onClick={() => setInsightIndex(i)} style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', background: i === insightIndex ? 'var(--color-green-500)' : 'var(--color-green-200)', cursor: 'pointer', transition: 'all 0.2s' }} />
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-lg)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
                            <Lightbulb size={16} color="var(--color-solar-500)" />
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-green-800)', lineHeight: 1.75, margin: 0 }}>
                            💡 <strong>AI Insight:</strong> {AI_INSIGHTS[insightIndex].text}
                        </p>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: 'var(--color-green-500)', textAlign: 'right' }}>
                        Powered by AgroVolt Economic Intelligence Engine · Updated 2h ago
                    </div>
                </div>

                {/* ══════ STACKED BAR CHART + EXPENSE LINE + GHOST BARS ══════ */}
                <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart3 size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                        Revenue vs Input Costs
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1.25rem' }}>
                        Stacked revenue bars · Red expense line · Ghost bars = AI forecast
                    </p>

                    {/* Chart */}
                    <div style={{ position: 'relative', height: '300px', padding: '0 0.5rem' }}>
                        {/* Y-axis labels */}
                        <div style={{ position: 'absolute', left: -4, top: 0, bottom: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            {[30, 20, 10, 0].map(v => (
                                <span key={v} style={{ fontSize: '0.5rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gray-300)' }}>₹{v}K</span>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem', height: '270px', marginLeft: '28px' }}>
                            {allMonths.map((m, i) => {
                                const total = m.crop + m.solar + m.carbon;
                                const barH = (total / 30000) * 240;
                                const expH = (m.expenses / 30000) * 240;
                                const isProjected = m.projected;

                                return (
                                    <div key={m.month} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                                        {/* Total label */}
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', fontWeight: 700, color: isProjected ? 'var(--color-gray-300)' : 'var(--color-gray-600)', marginBottom: '0.25rem' }}>
                                            ₹{(total / 1000).toFixed(1)}K
                                        </div>

                                        {/* Stacked bar */}
                                        <div style={{
                                            height: `${barH}px`,
                                            display: 'flex', flexDirection: 'column-reverse',
                                            borderRadius: '6px 6px 0 0',
                                            overflow: 'hidden',
                                            opacity: isProjected ? 0.45 : 1,
                                            border: isProjected ? '2px dashed var(--color-gray-300)' : 'none',
                                            background: isProjected ? 'rgba(249,250,251,0.5)' : 'none',
                                        }}>
                                            <div style={{ height: `${(m.crop / total) * 100}%`, background: 'var(--color-green-400)', transition: 'height 0.5s ease' }} />
                                            <div style={{ height: `${(m.solar / total) * 100}%`, background: 'var(--color-solar-400)', transition: 'height 0.5s ease' }} />
                                            <div style={{ height: `${(m.carbon / total) * 100}%`, background: 'var(--color-blue-400)', transition: 'height 0.5s ease' }} />
                                        </div>

                                        {/* Expense line marker */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: `${expH + 22}px`,
                                            left: '10%', right: '10%',
                                            height: '3px',
                                            background: '#EF4444',
                                            borderRadius: '2px',
                                            boxShadow: '0 0 4px rgba(239,68,68,0.4)',
                                        }}>
                                            <span style={{
                                                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                                                fontSize: '0.4375rem', fontFamily: 'var(--font-mono)', color: '#EF4444',
                                                whiteSpace: 'nowrap', fontWeight: 700,
                                            }}>
                                                ₹{(m.expenses / 1000).toFixed(1)}K
                                            </span>
                                        </div>

                                        {/* Net profit indicator */}
                                        {!isProjected && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: `${expH + 28}px`,
                                                left: '50%', transform: 'translateX(-50%)',
                                                fontSize: '0.375rem', fontFamily: 'var(--font-mono)',
                                                color: 'var(--color-green-600)', fontWeight: 700,
                                                background: 'rgba(240,253,244,0.9)', padding: '1px 4px', borderRadius: '3px',
                                                display: total - m.expenses > 0 ? 'block' : 'none',
                                            }}>
                                                +₹{((total - m.expenses) / 1000).toFixed(1)}K
                                            </div>
                                        )}

                                        {/* Month label */}
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isProjected ? 'var(--color-gray-300)' : 'var(--color-gray-500)', marginTop: '0.375rem' }}>
                                            {m.month}
                                        </div>
                                        {isProjected && (
                                            <div style={{ fontSize: '0.375rem', color: 'var(--color-gray-300)', fontStyle: 'italic' }}>AI Forecast</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Crop Income', color: 'var(--color-green-400)', icon: <Wheat size={11} /> },
                            { label: 'Solar Revenue', color: 'var(--color-solar-400)', icon: <Zap size={11} /> },
                            { label: 'Carbon Credits', color: 'var(--color-blue-400)', icon: <Leaf size={11} /> },
                            { label: 'Input Costs', color: '#EF4444', icon: <Minus size={11} /> },
                            { label: 'AI Projected', color: 'var(--color-gray-300)', icon: <Sparkles size={11} />, dashed: true },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: (item as any).dashed ? 'transparent' : item.color, border: (item as any).dashed ? `2px dashed ${item.color}` : 'none' }} />
                                {item.icon} {item.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══════ EXPENSE BREAKDOWN + ROI SIMULATOR (side by side) ══════ */}
                <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                    {/* Expense Breakdown */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CircleDollarSign size={18} color="#EF4444" /> Input Cost Breakdown
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {EXPENSE_ITEMS.map(exp => (
                                <div key={exp.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>{exp.icon} {exp.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-gray-700)' }}>₹{exp.monthly.toLocaleString()}/mo</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--color-gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(exp.monthly / 3500) * 100}%`, background: exp.color, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', borderRadius: 'var(--radius-lg)', background: '#FEF2F2', border: '1px solid #FECACA' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#991B1B' }}>Total Monthly Input Cost</span>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, color: '#DC2626' }}>₹{EXPENSE_ITEMS.reduce((s, e) => s + e.monthly, 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* ══════ WHAT-IF ROI SIMULATOR ══════ */}
                    <div className="card" style={{ background: 'linear-gradient(135deg, white, #FEFCE8)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <SlidersHorizontal size={18} color="var(--color-solar-600)" /> What-If ROI Simulator
                        </h3>

                        {/* Slider 1: Extra Panels */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-600)' }}>Add Extra Solar Panels</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-solar-600)' }}>+{extraPanels} panels ({extraPanels * 2}kW)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => setExtraPanels(Math.max(0, extraPanels - 1))} style={{ width: 28, height: 28, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                                <div style={{ flex: 1, height: 8, background: 'var(--color-gray-100)', borderRadius: 'var(--radius-full)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(extraPanels / 10) * 100}%`, background: 'linear-gradient(90deg, var(--color-solar-400), var(--color-solar-500))', borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
                                </div>
                                <button onClick={() => setExtraPanels(Math.min(10, extraPanels + 1))} style={{ width: 28, height: 28, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                            </div>
                            {extraPanels > 0 && (
                                <div style={{ fontSize: '0.5625rem', color: 'var(--color-solar-600)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                                    +₹{(panelBoost / 1000).toFixed(0)}K/year extra solar revenue · Setup cost: ~₹{(extraPanels * 45000 / 1000).toFixed(0)}K · Payback: {Math.round(extraPanels * 45000 / (panelBoost))} years
                                </div>
                            )}
                        </div>

                        {/* Toggle 2: Crop Switch */}
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-600)' }}>Switch 1 acre Rice → Turmeric</span>
                                <button onClick={() => setCropSwitch(!cropSwitch)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    {cropSwitch ? <ToggleRight size={32} color="var(--color-green-500)" /> : <ToggleLeft size={32} color="var(--color-gray-300)" />}
                                </button>
                            </div>
                            {cropSwitch && (
                                <div style={{ fontSize: '0.5625rem', color: 'var(--color-green-600)', fontFamily: 'var(--font-mono)' }}>
                                    Turmeric yields ₹32K more/acre than Rice · Market demand: HIGH (Agmarknet) · Takes 8-9 months
                                </div>
                            )}
                        </div>

                        {/* Simulated Income Result */}
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '1px solid var(--color-green-300)' }}>
                            <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-green-600)', marginBottom: '0.25rem' }}>Simulated Annual Income</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-green-800)' }}>₹{(simulatedIncome / 100000).toFixed(1)}L</span>
                                {(panelBoost + cropSwitchBoost) > 0 && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-green-600)', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                                        <ArrowUpRight size={14} /> +₹{((panelBoost + cropSwitchBoost) / 1000).toFixed(0)}K
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.5625rem', color: 'var(--color-green-600)', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>
                                Base: ₹4.8L + Solar boost: ₹{(panelBoost / 1000).toFixed(0)}K + Crop switch: ₹{(cropSwitchBoost / 1000).toFixed(0)}K
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══════ PROJECTIONS + MICRO-LOAN + CREDIT SCORE ══════ */}
                <div className="grid-2">
                    {/* Annual Projections */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Target size={18} color="var(--color-green-600)" /> Annual Projections
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {[
                                { label: 'Net Annual Income', value: `₹${(simulatedIncome / 100000).toFixed(1)}L`, icon: <IndianRupee size={15} color="var(--color-green-600)" />, bg: '#ECFDF5' },
                                { label: 'Monthly Avg Revenue', value: '₹20.4K', icon: <CalendarDays size={15} color="var(--color-blue-500)" />, bg: '#EFF6FF' },
                                { label: 'Input Cost Savings', value: '₹18,000', icon: <PiggyBank size={15} color="var(--color-solar-500)" />, bg: '#FFFBEB' },
                                { label: 'Solar ROI', value: '340%', icon: <Calculator size={15} color="var(--color-green-700)" />, bg: '#F0FDF4' },
                                { label: 'Profit Margin', value: `${profitMargin}%`, icon: <TrendingUp size={15} color="var(--color-green-600)" />, bg: '#ECFDF5' },
                                { label: 'Water Savings', value: '38%', icon: <Droplets size={15} color="#3B82F6" />, bg: '#EFF6FF' },
                            ].map(proj => (
                                <div key={proj.label} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 'var(--radius-xl)', background: proj.bg, border: '1px solid var(--color-gray-100)' }}>
                                    <div style={{ margin: '0 auto 0.375rem', width: 30, height: 30, borderRadius: 'var(--radius-lg)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                                        {proj.icon}
                                    </div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{proj.value}</div>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>{proj.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══════ YIELD-BACKED MICRO-LOAN + AI CREDIT SCORE ══════ */}
                    <div className="card" style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE, #EDE9FE)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Landmark size={18} color="#3B82F6" /> Yield-Backed Micro-Loan Readiness
                        </h3>

                        {/* AI Credit Score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: '50%',
                                background: `conic-gradient(${creditScore >= 720 ? '#22C55E' : creditScore >= 680 ? '#F59E0B' : '#EF4444'} ${(creditScore / 850) * 100}%, #E5E7EB ${(creditScore / 850) * 100}%)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: creditScore >= 720 ? '#16A34A' : '#D97706' }}>{creditScore}</span>
                                    <span style={{ fontSize: '0.375rem', color: 'var(--color-gray-400)', fontWeight: 600 }}>/ 850</span>
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                                    <BadgeCheck size={16} color="#22C55E" />
                                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: '#166534' }}>
                                        AI Credit Score: {creditScore >= 720 ? 'Excellent' : creditScore >= 680 ? 'Good' : 'Fair'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: '#1E40AF', lineHeight: 1.6 }}>
                                    Dual-income verification (Crop + Solar) detected.<br />
                                    6-month consistent earning history verified.
                                </div>
                            </div>
                        </div>

                        {/* Loan Eligibility Badge */}
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-xl)', background: 'white', border: '2px solid #86EFAC', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16A34A', marginBottom: '0.125rem' }}>Eligible for AIF Micro-Loan</div>
                                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#166534' }}>₹{(loanEligibility / 100000).toFixed(1)}L</span>
                                </div>
                                <div style={{ padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-full)', background: '#DCFCE7', border: '1px solid #86EFAC' }}>
                                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <ShieldCheck size={14} /> Pre-Approved
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Score factors */}
                        <div style={{ fontSize: '0.6875rem', color: '#1E3A8A' }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.25rem', fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score Factors</div>
                            {[
                                { factor: 'Dual Income Streams (Crop + Solar)', impact: '+45', plus: true },
                                { factor: `Solar Revenue (₹${(totalSolar / 1000).toFixed(1)}K verified)`, impact: `+${Math.min(Math.round(totalSolar / 1000), 30)}`, plus: true },
                                { factor: `Profit Margin (${profitMargin}%)`, impact: `+${profitMargin > 40 ? 25 : profitMargin > 30 ? 15 : 5}`, plus: true },
                                { factor: 'Carbon Credit Income (ESG verified)', impact: '+10', plus: true },
                            ].map(f => (
                                <div key={f.factor} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid rgba(30,58,138,0.08)' }}>
                                    <span>{f.factor}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#16A34A' }}>{f.impact}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
