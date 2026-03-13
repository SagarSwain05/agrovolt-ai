'use client';

import { useState, useEffect, useRef } from 'react';

// Use the env var directly — avoids the axios-layer NEXT_PUBLIC_API_URL issue
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://agrovolt-backend.onrender.com';

// Default: Bhubaneswar, Odisha
const DEFAULT_LAT = 20.2961;
const DEFAULT_LON = 85.8245;

export interface WeatherData {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    description: string;
    icon: string;
    clouds: number;
    pressure: number;
    sunrise: string;
    sunset: string;
    location: string;
    solarImpact: {
        cloudCover: number;
        estimatedEfficiency: number;
        recommendation: string;
    };
}

export interface WeatherState {
    weather: WeatherData | null;
    forecast: any[] | null;
    loading: boolean;
    error: string | null;
    isNight: boolean;
    lastUpdated: Date | null;
}

function parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[4].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

function checkIsNight(sunrise: string, sunset: string): boolean {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const sunriseMin = parseTimeToMinutes(sunrise);
    const sunsetMin = parseTimeToMinutes(sunset);
    return nowMinutes < sunriseMin || nowMinutes > sunsetMin;
}

const FALLBACK_WEATHER: WeatherData = {
    temperature: 28,
    feelsLike: 31,
    humidity: 65,
    windSpeed: 12,
    description: 'Partly cloudy',
    icon: '02d',
    clouds: 30,
    pressure: 1013,
    sunrise: '6:05 AM',
    sunset: '6:18 PM',
    location: 'Bhubaneswar',
    solarImpact: {
        cloudCover: 30,
        estimatedEfficiency: 88,
        recommendation: 'Good solar conditions — panels operating near peak efficiency.',
    },
};

const FALLBACK_FORECAST = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    tempMax: 30 + Math.round(Math.random() * 5),
    tempMin: 22 + Math.round(Math.random() * 3),
    humidity: 60 + Math.round(Math.random() * 20),
    clouds: Math.round(Math.random() * 50),
    description: ['Clear sky', 'Partly cloudy', 'Scattered clouds', 'Light rain'][i % 4],
    solarEfficiency: 80 + Math.round(Math.random() * 15),
}));

async function fetchWeatherData(lat: number, lon: number) {
    const [currentRes, forecastRes] = await Promise.all([
        fetch(`${API_BASE}/api/weather/current?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
        fetch(`${API_BASE}/api/weather/forecast?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);
    return { currentData: currentRes?.data, forecastData: forecastRes?.data?.forecast };
}

export function useWeather(lat: number, lon: number, geoLoaded: boolean): WeatherState {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [forecast, setForecast] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isNight, setIsNight] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const fetchedRef = useRef(false);

    // ── Fetch immediately with default coords, re-fetch if geo gives better coords ──
    useEffect(() => {
        // Use actual lat/lon if geo loaded, otherwise use defaults
        const fetchLat = geoLoaded ? lat : DEFAULT_LAT;
        const fetchLon = geoLoaded ? lon : DEFAULT_LON;

        // Skip if already fetched with good coords (geoLoaded) and data exists
        if (fetchedRef.current && geoLoaded && weather) return;

        let cancelled = false;

        async function doFetch() {
            try {
                setLoading(true);
                const { currentData: w, forecastData: f } = await fetchWeatherData(fetchLat, fetchLon);

                if (cancelled) return;

                if (w) {
                    setWeather(w);
                    setIsNight(checkIsNight(w.sunrise, w.sunset));
                } else {
                    setWeather(FALLBACK_WEATHER);
                    setIsNight(checkIsNight(FALLBACK_WEATHER.sunrise, FALLBACK_WEATHER.sunset));
                }

                if (f && f.length > 0) {
                    setForecast(f);
                } else {
                    setForecast(FALLBACK_FORECAST);
                }

                setLastUpdated(new Date());
                setError(null);
                fetchedRef.current = true;
            } catch (err: any) {
                if (cancelled) return;
                console.error('[useWeather] Fetch failed, using fallback:', err.message);
                setWeather(FALLBACK_WEATHER);
                setForecast(FALLBACK_FORECAST);
                setIsNight(checkIsNight(FALLBACK_WEATHER.sunrise, FALLBACK_WEATHER.sunset));
                setError(null); // Don't show error — fallback data is good enough
                fetchedRef.current = true;
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        doFetch();
        return () => { cancelled = true; };

        // Fetch immediately on mount (geoLoaded=false uses defaults), re-fetch when geo resolves
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geoLoaded]);

    // ── Refresh weather every 15 minutes ──
    useEffect(() => {
        const fetchLat = geoLoaded ? lat : DEFAULT_LAT;
        const fetchLon = geoLoaded ? lon : DEFAULT_LON;

        const timer = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/weather/current?lat=${fetchLat}&lon=${fetchLon}`, {
                    signal: AbortSignal.timeout(8000)
                }).then(r => r.json());
                const w = res?.data;
                if (w) {
                    setWeather(w);
                    setIsNight(checkIsNight(w.sunrise, w.sunset));
                    setLastUpdated(new Date());
                }
            } catch { /* silent — keep showing last known data */ }
        }, 15 * 60_000);

        return () => clearInterval(timer);
    }, [lat, lon, geoLoaded]);

    // ── Update isNight every minute ──
    useEffect(() => {
        if (!weather) return;
        const timer = setInterval(() => {
            setIsNight(checkIsNight(weather.sunrise, weather.sunset));
        }, 60_000);
        return () => clearInterval(timer);
    }, [weather]);

    return { weather, forecast, loading, error, isNight, lastUpdated };
}
