'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/lib/auth';
import { useChronos } from '@/hooks/useChronos';
import { useWeather } from '@/hooks/useWeather';
import {
    getSunPosition, getSunTimes, calcSolarEfficiency, calcOptimalTilt,
    calcEnergyToday, calcWaterSaved, getDayProgress, getSunIntensity, getDayOfYear,
    getTiltRecommendation,
} from '@/lib/solarEngine';
import { generateBriefing, generateTasks, type FarmTask } from '@/lib/briefingEngine';
import {
    Zap, Droplets, Leaf, IndianRupee, ScanLine, BarChart3,
    Sun, Moon, Wallet, CheckCircle2, Circle, ArrowRight, CloudSun, Cloud, CloudRain,
    Thermometer, Wind, TrendingUp, Activity, Sprout, ShieldCheck,
    BrainCircuit, Clock, MapPin, Sunrise, Sunset,
} from 'lucide-react';

// ─── Persistence helpers ────────────────────────────────────

const TASKS_KEY = 'agrovolt_tasks_done';

function loadDoneTaskIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const stored = localStorage.getItem(TASKS_KEY);
        if (!stored) return new Set();
        const parsed = JSON.parse(stored);
        // Reset if stored date is different from today
        if (parsed.date !== new Date().toDateString()) return new Set();
        return new Set(parsed.ids || []);
    } catch { return new Set(); }
}

function saveDoneTaskIds(ids: Set<string>) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TASKS_KEY, JSON.stringify({
        date: new Date().toDateString(),
        ids: Array.from(ids),
    }));
}

// ─── Weather icon helper ────────────────────────────────────

function getWeatherIcon(desc: string, isNight: boolean) {
    const d = desc.toLowerCase();
    if (d.includes('rain')) return <CloudRain size={18} color="var(--color-blue-500)" />;
    if (d.includes('cloud') || d.includes('overcast')) return <Cloud size={18} color="var(--color-gray-400)" />;
    if (isNight) return <Moon size={18} color="var(--color-blue-300)" />;
    return <Sun size={18} color="var(--color-solar-500)" />;
}

function getTaskIcon(category: string) {
    switch (category) {
        case 'irrigation': return <Droplets size={16} color="var(--color-blue-500)" />;
        case 'protection': return <ShieldCheck size={16} color="var(--color-green-500)" />;
        case 'monitoring': return <Activity size={16} color="var(--color-solar-500)" />;
        case 'harvest': return <Sprout size={16} color="var(--color-green-600)" />;
        case 'solar': return <Zap size={16} color="var(--color-solar-600)" />;
        case 'market': return <BarChart3 size={16} color="var(--color-blue-600)" />;
        default: return <Circle size={16} color="var(--color-gray-400)" />;
    }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ════════════════════════════════════════════════════════════

export default function DashboardPage() {
    const chronos = useChronos();
    const { weather, forecast, loading: weatherLoading, isNight } = useWeather(chronos.lat, chronos.lon, chronos.geoLoaded);

    // ─── Solar computations (suncalc) ──────────────────────
    const solar = useMemo(() => {
        const sunTimes = getSunTimes(chronos.currentTime, chronos.lat, chronos.lon);
        const sunPos = getSunPosition(chronos.currentTime, chronos.lat, chronos.lon);
        const cloud = weather?.clouds ?? 30;
        const humid = weather?.humidity ?? 50;
        const temp = weather?.temperature ?? 28;

        const efficiency = calcSolarEfficiency(sunPos.altitudeDeg, cloud, humid);
        const dayOfYear = getDayOfYear(chronos.currentTime);
        const optimalTilt = calcOptimalTilt(chronos.lat, dayOfYear);
        const currentTilt = optimalTilt + 3; // Simulate slightly off
        const energy = calcEnergyToday(
            chronos.lat, chronos.lon,
            sunTimes.sunrise, sunTimes.sunset, chronos.currentTime,
            cloud, humid
        );
        const hoursSinceSunrise = Math.max(0, (chronos.currentTime.getTime() - sunTimes.sunrise.getTime()) / 3_600_000);
        const waterSaved = calcWaterSaved(hoursSinceSunrise, temp);
        const dayProgress = getDayProgress(sunTimes.sunrise, sunTimes.sunset, chronos.currentTime);
        const sunIntensity = getSunIntensity(sunPos.altitudeDeg);

        return {
            sunTimes, sunPos, efficiency, optimalTilt, currentTilt, energy,
            waterSaved, dayProgress, sunIntensity, hoursSinceSunrise,
        };
    }, [chronos.currentTime, chronos.lat, chronos.lon, weather]);

    // ─── Tasks (interactive + persistent) ──────────────────
    const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setDoneIds(loadDoneTaskIds());
    }, []);

    const tasks = useMemo(() => {
        if (!weather) return [];
        const generated = generateTasks(
            chronos.hour, weather.temperature, weather.humidity,
            weather.clouds, weather.description.toLowerCase().includes('rain')
        );
        return generated.map(t => ({ ...t, done: doneIds.has(t.id) }));
    }, [chronos.hour, weather, doneIds]);

    function toggleTask(taskId: string) {
        setDoneIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            saveDoneTaskIds(next);
            return next;
        });
    }

    // ─── Briefing ──────────────────────────────────────────
    const { user } = useAuth();

    const briefing = useMemo(() => {
        if (!weather) return null;
        return generateBriefing({
            userName: user?.name || 'Farmer',
            timeOfDay: chronos.timeOfDay,
            hour: chronos.hour,
            temperature: weather.temperature,
            humidity: weather.humidity,
            weatherDesc: weather.description,
            cloudCover: weather.clouds,
            windSpeed: weather.windSpeed,
            solarEfficiency: solar.efficiency,
            energyToday: solar.energy,
            waterSaved: solar.waterSaved,
            tasksTotal: tasks.length,
            tasksDone: tasks.filter(t => t.done).length,
            sunrise: weather.sunrise,
            sunset: weather.sunset,
            location: weather.location,
        });
    }, [weather, chronos.timeOfDay, chronos.hour, solar, tasks, user]);

    // ─── Typewriter effect for briefing ────────────────────
    const [typedText, setTypedText] = useState('');
    const [doneTyping, setDoneTyping] = useState(false);

    useEffect(() => {
        if (!briefing) return;
        setTypedText('');
        setDoneTyping(false);
        let i = 0;
        const interval = setInterval(() => {
            if (i <= briefing.text.length) {
                setTypedText(briefing.text.slice(0, i));
                i++;
            } else {
                setDoneTyping(true);
                clearInterval(interval);
            }
        }, 12);
        return () => clearInterval(interval);
    }, [briefing?.text]);

    // ─── Carbon credits (accumulated base + today's generation) ──
    const userFarmSize = user?.farmSize || 2; // Default to 2 acres
    const baseCarbonCredits = 0.82 * (userFarmSize / 2); // Scale roughly by farm size
    const baseMonthlyEnergy = 280 * (userFarmSize / 2); // estimated monthly baseline kWh
    const todayCredits = Math.round(solar.energy * 0.034 * 100) / 100;
    const carbonCredits = Math.round((baseCarbonCredits + todayCredits) * 100) / 100;

    const projectedRevenue = Math.round(
        (baseMonthlyEnergy + solar.energy) * 8 + carbonCredits * 1800
    );

    // ─── Theme colors based on day/night ──────────────────
    const theme = isNight
        ? { briefingBg: 'linear-gradient(135deg, #1a2332, #0f172a)', badge: '#818cf8', badgeBg: 'rgba(129,140,248,0.15)', solarGauge: 'linear-gradient(135deg, #1e293b, #334155)' }
        : { briefingBg: 'linear-gradient(135deg, var(--color-green-800), var(--color-green-900))', badge: '#6ee7b7', badgeBg: 'rgba(52,211,153,0.2)', solarGauge: 'linear-gradient(135deg, var(--color-green-50), var(--color-solar-50))' };

    // ─── Loading state ────────────────────────────────────
    if (weatherLoading && !weather) {
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
            <Navbar
                title="Dashboard"
                subtitle={`${chronos.formattedDate} — ${chronos.formattedTime}`}
                temperature={weather?.temperature}
                isNight={isNight}
                weatherIcon={weather ? getWeatherIcon(weather.description, isNight) : undefined}
            />

            <div className="page-container">
                {/* ═══ AI BRIEFING ═══ */}
                {briefing && (
                    <div style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-xl)',
                        background: theme.briefingBg,
                        color: 'white',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        animation: 'fadeIn 0.5s ease forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <BrainCircuit size={18} strokeWidth={1.75} />
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.7 }}>
                                {briefing.title}
                            </span>
                            <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)', background: theme.badgeBg, color: theme.badge, fontWeight: 600 }}>
                                {briefing.badge}
                            </span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Clock size={12} /> {chronos.formattedTime}
                            </span>
                        </div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', lineHeight: 1.7, opacity: 0.9 }}>
                            {typedText}<span style={{ animation: 'pulse-ring 1s ease infinite', opacity: doneTyping ? 0 : 1 }}>|</span>
                        </p>
                    </div>
                )}

                {/* ═══ STAT CARDS ═══ */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <StatCard
                        icon={<Zap size={20} strokeWidth={1.75} />}
                        label="Solar Energy"
                        value={`${solar.energy} kWh`}
                        trend={solar.energy > 0 ? 'up' : undefined}
                        trendValue={solar.energy > 0 ? `${solar.efficiency}% eff.` : undefined}
                        variant="solar"
                    />
                    <StatCard
                        icon={<Droplets size={20} strokeWidth={1.75} />}
                        label="Water Saved"
                        value={`${solar.waterSaved.toLocaleString()} L`}
                        subValue="Panel shade savings"
                        variant="blue"
                    />
                    <StatCard
                        icon={<Leaf size={20} strokeWidth={1.75} />}
                        label="Carbon Credits"
                        value={carbonCredits.toFixed(2)}
                        subValue={`≈ ₹${Math.round(carbonCredits * 1800).toLocaleString()}`}
                        variant="green"
                    />
                    <StatCard
                        icon={<IndianRupee size={20} strokeWidth={1.75} />}
                        label="Projected Revenue"
                        value={`₹${projectedRevenue.toLocaleString()}`}
                        subValue="This month"
                        variant="green"
                    />
                </div>

                {/* ═══ QUICK ACTIONS ═══ */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                        { href: '/scan', icon: <ScanLine size={16} />, label: 'Scan Disease', color: 'var(--color-green-600)' },
                        { href: '/market', icon: <BarChart3 size={16} />, label: 'Market Prices', color: 'var(--color-blue-600)' },
                        { href: '/solar', icon: <Zap size={16} />, label: 'Solar Status', color: 'var(--color-solar-600)' },
                        { href: '/carbon', icon: <Wallet size={16} />, label: 'Carbon Wallet', color: 'var(--color-green-700)' },
                    ].map(action => (
                        <a key={action.label} href={action.href} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.625rem 1rem', borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--color-gray-200)', background: 'white',
                            fontSize: '0.8125rem', fontWeight: 500, color: action.color,
                            textDecoration: 'none', fontFamily: 'var(--font-body)', transition: 'all 0.2s ease',
                        }}>
                            {action.icon} {action.label}
                        </a>
                    ))}
                </div>

                {/* ═══ SPLIT VIEW: Tasks + Solar ═══ */}
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* INTERACTIVE TASK LIST */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Sprout size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                                    Today&apos;s Crop Actions
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>
                                    {tasks.filter(t => t.done).length}/{tasks.length} completed — Click to toggle
                                </p>
                            </div>
                            <a href="/crops" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-green-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-body)' }}>
                                View All <ArrowRight size={12} />
                            </a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {tasks.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleTask(item.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-lg)',
                                        background: item.done ? 'var(--color-gray-50)' : 'white',
                                        border: item.done ? '1px solid var(--color-gray-100)' : item.priority === 'high' ? '1px solid var(--color-green-200)' : '1px solid var(--color-gray-100)',
                                        cursor: 'pointer', transition: 'all 0.2s ease',
                                        opacity: item.done ? 0.6 : 1,
                                    }}
                                >
                                    {item.done
                                        ? <CheckCircle2 size={18} color="var(--color-green-500)" />
                                        : <Circle size={18} color="var(--color-gray-300)" strokeWidth={1.5} />
                                    }
                                    {getTaskIcon(item.category)}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '0.8125rem',
                                            color: item.done ? 'var(--color-gray-400)' : 'var(--color-gray-700)',
                                            textDecoration: item.done ? 'line-through' : 'none',
                                            fontWeight: 500,
                                        }}>
                                            {item.task}
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', fontFamily: 'var(--font-mono)' }}>
                                            {item.time}
                                            {item.priority === 'high' && !item.done && (
                                                <span style={{ marginLeft: '0.5rem', color: 'var(--color-red-500)', fontWeight: 600, fontSize: '0.6rem', textTransform: 'uppercase' }}>● Priority</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LIVE SOLAR STATUS */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isNight ? <Moon size={20} strokeWidth={1.75} color="var(--color-blue-400)" /> : <Zap size={20} strokeWidth={1.75} color="var(--color-solar-500)" />}
                                    {isNight ? 'Solar — Offline' : "Today's Solar Status"}
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>
                                    {isNight ? 'Panels resting — summary below' : 'Real-time • suncalc + weather data'}
                                </p>
                            </div>
                            <a href="/solar" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-solar-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'var(--font-body)' }}>
                                Details <ArrowRight size={12} />
                            </a>
                        </div>

                        {/* Efficiency Gauge */}
                        <div style={{
                            textAlign: 'center', padding: '1.25rem',
                            background: theme.solarGauge,
                            borderRadius: 'var(--radius-xl)', marginBottom: '0.75rem',
                        }}>
                            <div style={{
                                fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800,
                                color: isNight ? 'var(--color-gray-400)' : solar.efficiency > 70 ? 'var(--color-green-700)' : 'var(--color-solar-600)',
                                letterSpacing: '-0.03em', transition: 'color 0.5s ease',
                            }}>
                                {solar.efficiency}%
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: isNight ? 'var(--color-gray-500)' : 'var(--color-gray-600)', fontWeight: 500 }}>
                                {isNight ? 'Panels Offline' : 'Panel Efficiency'}
                            </div>
                            {!isNight && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-green-600)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    <TrendingUp size={14} /> +3% bio-cooling • Sun at {Math.round(solar.sunPos.altitudeDeg)}°
                                </div>
                            )}
                            {/* Day progress bar */}
                            <div style={{ marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-gray-400)', marginBottom: '0.25rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sunrise size={12} /> {solar.sunTimes.sunrise.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                    <span>{solar.dayProgress}%</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sunset size={12} /> {solar.sunTimes.sunset.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                </div>
                                <div style={{ height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }}>
                                    <div style={{ height: '100%', width: `${solar.dayProgress}%`, borderRadius: '2px', background: isNight ? 'var(--color-blue-400)' : 'var(--color-solar-500)', transition: 'width 1s ease' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {[
                                { label: solar.efficiency > 0 ? `Generating ${solar.energy} kWh today (live)` : `Today's total: ${solar.energy} kWh — panels offline`, icon: <Zap size={16} color={solar.energy > 0 ? 'var(--color-solar-500)' : 'var(--color-gray-400)'} /> },
                                { label: getTiltRecommendation(solar.currentTilt, solar.optimalTilt), icon: <TrendingUp size={16} color="var(--color-solar-500)" /> },
                                { label: `Bio-cooling active — crops reducing panel temp by ${Math.round(2 + solar.sunIntensity * 2)}°C`, icon: <Thermometer size={16} color="var(--color-blue-500)" /> },
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                                    padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)',
                                    background: 'var(--color-gray-50)', fontSize: '0.8125rem', color: 'var(--color-gray-600)',
                                }}>
                                    {item.icon} {item.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ 7-DAY WEATHER FORECAST ═══ */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CloudSun size={20} strokeWidth={1.75} color="var(--color-blue-500)" />
                                7-Day Weather Forecast
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>
                                {forecast ? 'Live from OpenWeatherMap API' : 'Forecast data loading...'}
                            </p>
                        </div>
                    </div>

                    <div className="scrollbar-hide" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {(forecast || []).slice(0, 7).map((d: any, i: number) => {
                            const dayName = d.day || new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' });
                            const dateStr = d.date ? new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
                            const clouds = d.clouds ?? 30;
                            const eff = d.solarEfficiency ?? Math.max(50, 100 - clouds * 0.4);
                            const desc = d.description || (clouds > 60 ? 'Cloudy' : clouds > 30 ? 'Partly cloudy' : 'Clear sky');
                            const isToday = i === 0;
                            const weatherIcon = clouds > 70 ? <CloudRain size={22} color="var(--color-blue-500)" />
                                : clouds > 50 ? <Cloud size={22} color="var(--color-gray-400)" />
                                    : clouds > 25 ? <CloudSun size={22} color="var(--color-solar-500)" />
                                        : <Sun size={22} color="var(--color-solar-500)" />;

                            return (
                                <div key={i} style={{
                                    textAlign: 'center' as const, padding: '0.75rem 0.375rem',
                                    borderRadius: 'var(--radius-xl)',
                                    background: isToday ? 'linear-gradient(135deg, var(--color-green-50), var(--color-blue-50))' : 'var(--color-gray-50)',
                                    border: isToday ? '2px solid var(--color-green-300)' : '1px solid transparent',
                                    animation: `fadeIn 0.3s ease ${i * 0.06}s forwards`,
                                    animationFillMode: 'backwards',
                                    flexShrink: 0,
                                    minWidth: '120px',
                                    flex: '1 0 120px',
                                }}>
                                    {/* Day label */}
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: isToday ? 'var(--color-green-700)' : 'var(--color-gray-700)', marginBottom: '0.125rem' }}>
                                        {isToday ? 'Today' : dayName}
                                    </div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                                        {dateStr}
                                    </div>

                                    {/* Weather icon */}
                                    <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                        {weatherIcon}
                                    </div>

                                    {/* Temp range */}
                                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-gray-800)', fontSize: '1rem', letterSpacing: '-0.02em' }}>
                                        {d.tempMax ?? '--'}°
                                    </div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', fontFamily: 'var(--font-mono)', marginBottom: '0.375rem' }}>
                                        {d.tempMin ?? '--'}°C
                                    </div>

                                    {/* Condition */}
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-500)', textTransform: 'capitalize', marginBottom: '0.375rem', lineHeight: 1.2, minHeight: '1.5em' }}>
                                        {desc}
                                    </div>

                                    {/* Humidity bar */}
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-blue-500)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.15rem' }}>
                                        <Droplets size={9} /> {d.humidity ?? '--'}%
                                    </div>

                                    {/* Solar efficiency indicator */}
                                    <div style={{
                                        marginTop: '0.25rem', padding: '0.125rem 0.375rem',
                                        borderRadius: 'var(--radius-full)',
                                        background: eff >= 80 ? 'rgba(34,197,94,0.1)' : eff >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(156,163,175,0.15)',
                                        fontSize: '0.5625rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                                        color: eff >= 80 ? 'var(--color-green-600)' : eff >= 60 ? 'var(--color-solar-600)' : 'var(--color-gray-500)',
                                    }}>
                                        ⚡{Math.round(eff)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ BOTTOM WIDGETS ═══ */}
                <div className="grid-3">
                    {/* Live Weather */}
                    <div className="card">
                        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            {weather ? getWeatherIcon(weather.description, isNight) : <CloudSun size={18} color="var(--color-solar-500)" />}
                            Weather
                            {weather?.location && <span style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--color-gray-400)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><MapPin size={10} />{weather.location}</span>}
                        </h4>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-gray-800)', letterSpacing: '-0.02em' }}>
                            {weather?.temperature ?? '--'}°C
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                            {weather?.description ?? 'Loading...'}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-gray-400)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Droplets size={12} /> {weather?.humidity ?? '--'}%</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Wind size={12} /> {weather?.windSpeed ?? '--'} km/h</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Cloud size={12} /> {weather?.clouds ?? '--'}%</span>
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: 'var(--color-gray-400)', display: 'flex', gap: '1rem' }}>
                            <span>☀️ {weather?.sunrise}</span>
                            <span>🌙 {weather?.sunset}</span>
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
                                    <div style={{ height: '100%', width: `${item.pct}%`, borderRadius: '2px', background: item.pct > 85 ? 'var(--color-green-500)' : 'var(--color-solar-400)', transition: 'width 0.5s ease' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
