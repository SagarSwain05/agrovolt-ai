'use client';

import React, { useMemo } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useChronos } from '@/hooks/useChronos';
import { useWeather } from '@/hooks/useWeather';
import {
    getSunPosition, getSunTimes, calcSolarEfficiency, calcOptimalTilt,
    calcEnergyToday, getDayProgress, getSunIntensity, getDayOfYear,
    getTiltRecommendation, calcWaterSaved,
} from '@/lib/solarEngine';
import {
    Zap, BarChart3, Wrench, IndianRupee, TrendingUp,
    Sun, Moon, CloudSun, Cloud, CloudRain, Wind, Thermometer, CheckCircle2,
    AlertTriangle, RotateCw, Cable, Droplets, CircleDot,
    Sunrise, Sunset, Clock, BrainCircuit, ArrowRight,
} from 'lucide-react';

function getWeatherIcon(clouds: number, size: number = 22) {
    if (clouds > 70) return <CloudRain size={size} color="var(--color-blue-500)" />;
    if (clouds > 50) return <Cloud size={size} color="var(--color-gray-400)" />;
    if (clouds > 25) return <CloudSun size={size} color="var(--color-solar-500)" />;
    return <Sun size={size} color="var(--color-solar-500)" />;
}

export default function SolarPage() {
    const chronos = useChronos();
    const { weather, forecast, loading, isNight } = useWeather(chronos.lat, chronos.lon, chronos.geoLoaded);

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
        const currentTilt = optimalTilt + 5; // Simulate slightly off
        const energy = calcEnergyToday(
            chronos.lat, chronos.lon,
            sunTimes.sunrise, sunTimes.sunset, chronos.currentTime,
            cloud, humid
        );
        const hoursSinceSunrise = Math.max(0, (chronos.currentTime.getTime() - sunTimes.sunrise.getTime()) / 3_600_000);
        const waterSaved = calcWaterSaved(hoursSinceSunrise, temp);
        const dayProgress = getDayProgress(sunTimes.sunrise, sunTimes.sunset, chronos.currentTime);
        const sunIntensity = getSunIntensity(sunPos.altitudeDeg);
        const tiltDiff = Math.abs(currentTilt - optimalTilt);
        const effGain = Math.round(tiltDiff * 0.3 + tiltDiff * 0.5);

        return {
            sunTimes, sunPos, efficiency, optimalTilt, currentTilt, energy,
            waterSaved, dayProgress, sunIntensity, hoursSinceSunrise, tiltDiff, effGain, temp,
        };
    }, [chronos.currentTime, chronos.lat, chronos.lon, weather]);

    // ─── Revenue & panel metrics ─────────────────────────
    const revenuePerKwh = 6;
    const panelCount = 12;
    const panelCapacityKW = 5;
    const revenueToday = Math.round(solar.energy * revenuePerKwh);
    const bioCoolingReduction = Math.round(2 + solar.sunIntensity * 2);
    const panelTemp = weather ? Math.round(weather.temperature + 15 - bioCoolingReduction) : 42;
    const outputDrop = solar.efficiency > 0 ? Math.max(0, Math.round((1 - solar.efficiency / 95) * 100)) : 0;

    // ─── Sun position for visualization ──────────────────
    const sunAngle = solar.sunPos.altitudeDeg;
    const sunX = 30 + solar.dayProgress * 0.4; // 30% to 70% across
    const sunY = Math.max(10, 60 - sunAngle * 0.8); // higher sun = higher position

    // ─── Panel health checks ────────────────────────────
    const panelChecks = [
        {
            label: 'Dust Level',
            status: weather && weather.humidity > 70 ? 'Monitor' : 'Clean',
            icon: <Droplets size={18} color="var(--color-blue-500)" />,
            badge: weather && weather.humidity > 70 ? 'badge-solar' : 'badge-green',
            note: weather && weather.humidity > 70 ? 'High humidity may cause dew buildup' : undefined,
        },
        {
            label: 'Surface Cracks',
            status: 'None',
            icon: <CircleDot size={18} color="var(--color-gray-400)" />,
            badge: 'badge-green',
        },
        {
            label: 'Temperature',
            status: `${panelTemp}°C`,
            icon: <Thermometer size={18} color="var(--color-solar-500)" />,
            badge: panelTemp > 50 ? 'badge-red' : 'badge-solar',
            note: `Bio-cooling active (-${bioCoolingReduction}°C from crops)`,
        },
        {
            label: 'Wiring',
            status: 'Secure',
            icon: <Cable size={18} color="var(--color-gray-500)" />,
            badge: 'badge-green',
        },
        {
            label: 'Output Drop',
            status: `${outputDrop}%`,
            icon: <AlertTriangle size={18} color={outputDrop > 10 ? 'var(--color-red-500)' : 'var(--color-green-500)'} />,
            badge: outputDrop > 10 ? 'badge-red' : 'badge-green',
            note: outputDrop > 10 ? `Cloud cover reducing output by ${outputDrop}%` : 'Performing at rated capacity',
        },
    ];

    // ─── Hourly generation curve ────────────────────────
    const hourlyData = useMemo(() => {
        if (!solar.sunTimes) return [];
        const points: { hour: number; label: string; efficiency: number; kwh: number }[] = [];
        const cloud = weather?.clouds ?? 30;
        const humid = weather?.humidity ?? 50;

        for (let h = 5; h <= 19; h++) {
            const t = new Date(chronos.currentTime);
            t.setHours(h, 0, 0, 0);
            const pos = getSunPosition(t, chronos.lat, chronos.lon);
            const eff = calcSolarEfficiency(pos.altitude * (180 / Math.PI), cloud, humid);
            const kwh = (panelCapacityKW / 1000) * panelCount * eff * 0.01;
            const isPast = h <= chronos.hour;
            points.push({
                hour: h,
                label: `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`,
                efficiency: eff,
                kwh: Math.round(kwh * 10) / 10,
            });
        }
        return points;
    }, [chronos.currentTime, chronos.lat, chronos.lon, weather]);

    const maxHourlyEff = Math.max(...hourlyData.map(h => h.efficiency), 1);

    if (loading && !weather) {
        return (
            <div>
                <Navbar title="Solar Optimization" subtitle="Loading real-time solar data..." />
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
                title="Solar Optimization"
                subtitle={`${chronos.formattedDate} — ${chronos.formattedTime}`}
                temperature={weather?.temperature}
                isNight={isNight}
                weatherIcon={weather ? (isNight ? <Moon size={14} /> : <Sun size={14} color="var(--color-solar-500)" />) : undefined}
            />

            <div className="page-container">
                {/* ═══ STAT CARDS ═══ */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <StatCard
                        icon={<Zap size={20} strokeWidth={1.75} />}
                        label="Energy Today"
                        value={`${solar.energy} kWh`}
                        trend={solar.energy > 0 ? 'up' : undefined}
                        trendValue={solar.energy > 0 ? `${solar.efficiency}% eff.` : undefined}
                        variant="solar"
                    />
                    <StatCard
                        icon={<BarChart3 size={20} strokeWidth={1.75} />}
                        label="Panel Efficiency"
                        value={`${solar.efficiency}%`}
                        subValue={isNight ? 'Panels offline' : `↑${bioCoolingReduction}% bio-cooling`}
                        variant="green"
                    />
                    <StatCard
                        icon={<Wrench size={20} strokeWidth={1.75} />}
                        label="Panel Count"
                        value={`${panelCount}`}
                        subValue={`${panelCapacityKW} kW capacity`}
                        variant="default"
                    />
                    <StatCard
                        icon={<IndianRupee size={20} strokeWidth={1.75} />}
                        label="Revenue Today"
                        value={`₹${revenueToday}`}
                        subValue={`₹${revenuePerKwh}/kWh`}
                        variant="green"
                    />
                </div>

                {/* ═══ TILT OPTIMIZER + PANEL HEALTH ═══ */}
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* AR Tilt Optimizer */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <RotateCw size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                            AR Tilt Optimizer
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1rem' }}>
                            suncalc-driven • {isNight ? 'Optimal for tomorrow' : `Sun at ${Math.round(sunAngle)}° altitude`}
                        </p>

                        {/* Visual Tilt Guide with live sun */}
                        <div style={{
                            position: 'relative', width: '100%', height: '220px',
                            background: isNight
                                ? 'linear-gradient(180deg, #1e293b 0%, #334155 100%)'
                                : 'linear-gradient(180deg, #e0f2fe 0%, #f0fdf4 100%)',
                            borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '0.75rem',
                            transition: 'background 0.5s ease',
                        }}>
                            {/* Animated Sun / Moon tracking across sky */}
                            <div style={{
                                position: 'absolute',
                                left: `${sunX}%`, top: `${sunY}%`,
                                transform: 'translate(-50%, -50%)',
                                transition: 'all 2s ease',
                                animation: 'float 4s ease-in-out infinite',
                            }}>
                                {isNight
                                    ? <Moon size={30} color="#94a3b8" fill="#64748b" />
                                    : <Sun size={36} color="var(--color-solar-400)" fill="var(--color-solar-300)" />
                                }
                            </div>

                            {/* Panel visualization */}
                            <svg viewBox="0 0 400 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                                {/* Optimal tilt line */}
                                <line x1="100" y1="160" x2="300" y2={160 - Math.tan((solar.optimalTilt * Math.PI) / 180) * 200}
                                    stroke="var(--color-green-500)" strokeWidth="4" strokeLinecap="round" opacity="0.5" strokeDasharray="8" />
                                {/* Current tilt line */}
                                <line x1="100" y1="160" x2="300" y2={160 - Math.tan((solar.currentTilt * Math.PI) / 180) * 200}
                                    stroke={isNight ? 'var(--color-gray-400)' : 'var(--color-solar-500)'} strokeWidth="4" strokeLinecap="round" />
                                {/* Ground */}
                                <line x1="50" y1="165" x2="350" y2="165" stroke="var(--color-gray-300)" strokeWidth="1" />
                            </svg>

                            {/* Labels */}
                            <div style={{
                                position: 'absolute', bottom: '12px', left: 0, right: 0,
                                display: 'flex', justifyContent: 'center', gap: '2.5rem',
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.5625rem', color: isNight ? 'var(--color-gray-400)' : 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Current Tilt</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: isNight ? 'var(--color-gray-300)' : 'var(--color-gray-700)' }}>{solar.currentTilt}°</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-green-500)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Optimal Tilt</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-green-500)' }}>{solar.optimalTilt}°</div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '0.75rem', background: 'var(--color-solar-50)',
                            borderRadius: 'var(--radius-lg)', borderLeft: '3px solid var(--color-solar-400)',
                            fontSize: '0.8125rem', color: 'var(--color-gray-700)',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}>
                            <Zap size={16} color="var(--color-solar-600)" />
                            <span>
                                {solar.tiltDiff <= 2
                                    ? <>Panel tilt is <strong style={{ color: 'var(--color-green-600)' }}>optimal</strong> — no adjustment needed.</>
                                    : <>Adjust tilt to <strong>{solar.optimalTilt}°</strong> for an estimated <strong style={{ color: 'var(--color-green-600)' }}>+{solar.effGain}% efficiency gain</strong>. Season: {chronos.currentTime.getMonth() < 3 || chronos.currentTime.getMonth() > 9 ? 'Winter — steeper tilt' : 'Summer — flatter tilt'}.</>
                                }
                            </span>
                        </div>
                    </div>

                    {/* Panel Health Monitor */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            Panel Health Monitor
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '1rem' }}>
                            AI-powered diagnostics • {weather?.location || 'Bhubaneswar'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {panelChecks.map((check, i) => (
                                <div key={check.label} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.625rem 0.75rem', borderRadius: 'var(--radius-lg)',
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

                {/* ═══ HOURLY GENERATION CURVE (Today) ═══ */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Zap size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                                Today&apos;s Generation Curve
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>
                                Hourly efficiency from suncalc + weather • {solar.energy} kWh total
                            </p>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> {chronos.formattedTime}
                        </div>
                    </div>

                    {/* Day progress */}
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--color-gray-400)', marginBottom: '0.25rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sunrise size={12} /> {solar.sunTimes.sunrise.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            <span>Day Progress: {solar.dayProgress}%</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Sunset size={12} /> {solar.sunTimes.sunset.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--color-gray-100)', borderRadius: '3px' }}>
                            <div style={{ height: '100%', width: `${solar.dayProgress}%`, borderRadius: '3px', background: 'linear-gradient(90deg, var(--color-solar-400), var(--color-green-500))', transition: 'width 1s ease' }} />
                        </div>
                    </div>

                    {/* Hourly bars */}
                    <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.25rem' }}>
                        {hourlyData.map((h, i) => {
                            const isPast = h.hour <= chronos.hour;
                            const isCurrent = h.hour === chronos.hour;
                            const barH = Math.max(4, (h.efficiency / maxHourlyEff) * 120);
                            return (
                                <div key={h.hour} style={{
                                    textAlign: 'center',
                                    animation: `fadeIn 0.2s ease ${i * 0.03}s forwards`,
                                    animationFillMode: 'backwards',
                                }}>
                                    <div style={{ fontSize: '0.5625rem', fontWeight: 600, color: isCurrent ? 'var(--color-green-700)' : 'var(--color-gray-500)', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                                        {h.efficiency > 0 ? `${h.efficiency}%` : ''}
                                    </div>
                                    <div style={{
                                        height: `${barH}px`, borderRadius: 'var(--radius-md)',
                                        background: isCurrent
                                            ? 'linear-gradient(to top, var(--color-green-600), var(--color-green-400))'
                                            : isPast
                                                ? 'linear-gradient(to top, var(--color-solar-500), var(--color-solar-300))'
                                                : 'linear-gradient(to top, var(--color-gray-200), var(--color-gray-100))',
                                        border: isCurrent ? '2px solid var(--color-green-500)' : 'none',
                                        transition: 'height 0.5s ease',
                                        opacity: isPast || isCurrent ? 1 : 0.5,
                                    }} />
                                    <div style={{ fontSize: '0.5625rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--color-green-700)' : 'var(--color-gray-400)', marginTop: '0.375rem' }}>
                                        {h.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ 7-DAY SOLAR+WEATHER FORECAST ═══ */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BrainCircuit size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                                7-Day Solar Forecast
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: '0.125rem' }}>
                                AI-predicted energy output • weather-integrated
                            </p>
                        </div>
                    </div>

                    <div className="scrollbar-hide" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {(forecast || []).slice(0, 7).map((d: any, i: number) => {
                            const dayName = d.day || new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' });
                            const dateStr = d.date ? new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
                            const clouds = d.clouds ?? 30;
                            const eff = d.solarEfficiency ?? Math.max(50, 100 - clouds * 0.4);
                            const estimatedKwh = Math.round(panelCapacityKW * solar.sunTimes.dayLengthHours * 0.5 * (eff / 100) * 10) / 10;
                            const desc = d.description || (clouds > 60 ? 'Cloudy' : clouds > 30 ? 'Partly cloudy' : 'Clear sky');
                            const isToday = i === 0;

                            return (
                                <div key={i} style={{
                                    textAlign: 'center' as const, padding: '0.75rem 0.25rem',
                                    borderRadius: 'var(--radius-xl)',
                                    background: isToday ? 'linear-gradient(135deg, var(--color-green-50), var(--color-solar-50))' : 'var(--color-gray-50)',
                                    border: isToday ? '2px solid var(--color-green-300)' : '1px solid transparent',
                                    animation: `fadeIn 0.3s ease ${i * 0.06}s forwards`,
                                    animationFillMode: 'backwards',
                                    flexShrink: 0,
                                    minWidth: '120px',
                                    flex: '1 0 120px',
                                }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: isToday ? 'var(--color-green-700)' : 'var(--color-gray-700)' }}>
                                        {isToday ? 'Today' : dayName}
                                    </div>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-400)', marginBottom: '0.375rem', fontFamily: 'var(--font-mono)' }}>{dateStr}</div>

                                    <div style={{ margin: '0.375rem 0', display: 'flex', justifyContent: 'center' }}>
                                        {getWeatherIcon(clouds)}
                                    </div>

                                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-gray-800)' }}>
                                        {d.tempMax ?? '--'}°
                                    </div>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-400)', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem' }}>
                                        {d.tempMin ?? '--'}°C
                                    </div>

                                    <div style={{ fontSize: '0.5rem', color: 'var(--color-gray-500)', textTransform: 'capitalize', minHeight: '1.2em', lineHeight: 1.2, marginBottom: '0.25rem' }}>
                                        {desc}
                                    </div>

                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-blue-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.15rem', marginBottom: '0.25rem' }}>
                                        <Droplets size={9} /> {d.humidity ?? '--'}%
                                    </div>

                                    {/* Estimated kWh */}
                                    <div style={{
                                        padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-full)',
                                        background: estimatedKwh > 15 ? 'rgba(34,197,94,0.1)' : estimatedKwh > 10 ? 'rgba(245,158,11,0.1)' : 'rgba(156,163,175,0.15)',
                                        fontSize: '0.5625rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                                        color: estimatedKwh > 15 ? 'var(--color-green-700)' : estimatedKwh > 10 ? 'var(--color-solar-600)' : 'var(--color-gray-500)',
                                    }}>
                                        ⚡{estimatedKwh} kWh
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div >
    );
}
