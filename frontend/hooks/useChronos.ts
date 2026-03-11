'use client';

import { useState, useEffect, useCallback } from 'react';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface ChronosState {
    currentTime: Date;
    hour: number;
    minute: number;
    timeOfDay: TimeOfDay;
    greeting: string;
    lat: number;
    lon: number;
    geoLoaded: boolean;
    formattedTime: string;
    formattedDate: string;
}

function getTimeOfDay(hour: number): TimeOfDay {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
}

function getGreeting(timeOfDay: TimeOfDay): string {
    switch (timeOfDay) {
        case 'morning': return 'Good morning';
        case 'afternoon': return 'Good afternoon';
        case 'evening': return 'Good evening';
        case 'night': return 'Good night';
    }
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    });
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}

// Default: Bhubaneswar, Odisha
const DEFAULT_LAT = 20.2961;
const DEFAULT_LON = 85.8245;

export function useChronos(): ChronosState {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [lat, setLat] = useState(DEFAULT_LAT);
    const [lon, setLon] = useState(DEFAULT_LON);
    const [geoLoaded, setGeoLoaded] = useState(false);

    // Geolocation — try once on mount
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLat(pos.coords.latitude);
                    setLon(pos.coords.longitude);
                    setGeoLoaded(true);
                },
                () => {
                    // Permission denied or unavailable — use Bhubaneswar defaults
                    setGeoLoaded(true);
                },
                { timeout: 5000, enableHighAccuracy: false }
            );
        } else {
            setGeoLoaded(true);
        }
    }, []);

    // Clock tick — every 60 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60_000);
        return () => clearInterval(timer);
    }, []);

    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const timeOfDay = getTimeOfDay(hour);

    return {
        currentTime,
        hour,
        minute,
        timeOfDay,
        greeting: getGreeting(timeOfDay),
        lat,
        lon,
        geoLoaded,
        formattedTime: formatTime(currentTime),
        formattedDate: formatDate(currentTime),
    };
}
