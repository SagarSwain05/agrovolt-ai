'use client';

import { useState, useEffect, useRef } from 'react';
import { weatherAPI } from '@/lib/api';

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
    // Parse "6:05 AM" or "6:18:00 pm" format
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

export function useWeather(lat: number, lon: number, geoLoaded: boolean): WeatherState {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [forecast, setForecast] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isNight, setIsNight] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const fetchedRef = useRef(false);

    // Fetch weather
    useEffect(() => {
        if (!geoLoaded) return;
        if (fetchedRef.current && weather) return; // don't refetch if already loaded

        async function fetchWeather() {
            try {
                setLoading(true);
                const [currentRes, forecastRes] = await Promise.all([
                    weatherAPI.getCurrent(lat, lon),
                    weatherAPI.getForecast(lat, lon),
                ]);

                const w = currentRes.data?.data;
                if (w) {
                    setWeather(w);
                    setIsNight(checkIsNight(w.sunrise, w.sunset));
                }

                const f = forecastRes.data?.data?.forecast;
                if (f) setForecast(f);

                setLastUpdated(new Date());
                setError(null);
                fetchedRef.current = true;
            } catch (err: any) {
                console.error('Weather fetch error:', err);
                setError(err.message || 'Failed to load weather');
                // Set fallback data so the UI still works
                setWeather({
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
                        recommendation: 'Good solar conditions',
                    },
                });
                setIsNight(checkIsNight('6:05 AM', '6:18 PM'));
                fetchedRef.current = true;
            } finally {
                setLoading(false);
            }
        }

        fetchWeather();
    }, [lat, lon, geoLoaded]);

    // Refresh weather every 10 minutes
    useEffect(() => {
        if (!geoLoaded) return;
        const timer = setInterval(async () => {
            try {
                const res = await weatherAPI.getCurrent(lat, lon);
                const w = res.data?.data;
                if (w) {
                    setWeather(w);
                    setIsNight(checkIsNight(w.sunrise, w.sunset));
                    setLastUpdated(new Date());
                }
            } catch { /* silent refresh failure */ }
        }, 10 * 60_000);
        return () => clearInterval(timer);
    }, [lat, lon, geoLoaded]);

    // Update isNight every minute (sun may have set/risen)
    useEffect(() => {
        if (!weather) return;
        const timer = setInterval(() => {
            setIsNight(checkIsNight(weather.sunrise, weather.sunset));
        }, 60_000);
        return () => clearInterval(timer);
    }, [weather]);

    return { weather, forecast, loading, error, isNight, lastUpdated };
}
