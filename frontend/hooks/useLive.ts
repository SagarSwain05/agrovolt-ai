'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError, iotAPI } from '@/lib/api';

/**
 * Fetch once and optionally re-poll. Keeps the last good data while refreshing
 * so the UI never flashes empty.
 */
export function useApi<T>(fetcher: () => Promise<{ data: { data: T } }>, deps: unknown[] = [], pollMs = 0) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const fetchRef = useRef(fetcher);
    fetchRef.current = fetcher;

    const load = useCallback(async () => {
        try {
            const res = await fetchRef.current();
            setData(res.data.data);
            setError(null);
            setUpdatedAt(new Date());
        } catch (e) {
            setError(apiError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        load();
        if (!pollMs) return;
        const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, pollMs);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, error, loading, updatedAt, reload: load, setData };
}

export interface SensorReading {
    source: 'device' | 'virtual';
    measured?: string[];
    ts: string;
    ambientTempC?: number | null;
    underCanopyTempC?: number | null;
    humidityPct?: number | null;
    panelTempC?: number | null;
    panelTempUncooledC?: number | null;
    irradianceWm2?: number | null;
    lux?: number | null;
    parCrop?: number | null;
    soilMoisturePct?: number | null;
    soilTempC?: number | null;
    soilN?: number | null;
    soilP?: number | null;
    soilK?: number | null;
    soilPH?: number | null;
    powerW?: number | null;
    energyTodayKwh?: number | null;
    panelTiltDeg?: number | null;
    bioCoolingDeltaC?: number | null;
}

/** Live sensor stream over Server-Sent Events (one reading every ~15 s). */
export function useTelemetry(initial?: SensorReading | null) {
    const [reading, setReading] = useState<SensorReading | null>(initial || null);
    const [connected, setConnected] = useState(false);
    const [history, setHistory] = useState<SensorReading[]>([]);

    useEffect(() => {
        if (initial && !reading) setReading(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial]);

    useEffect(() => {
        let es: EventSource | null = null;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let closed = false;
        const open = () => {
            es = new EventSource(iotAPI.streamUrl());
            es.addEventListener('reading', (e) => {
                try {
                    const r = JSON.parse((e as MessageEvent).data) as SensorReading;
                    setReading(r);
                    setHistory((h) => [...h.slice(-59), r]);
                    setConnected(true);
                } catch { /* malformed event */ }
            });
            es.onerror = () => {
                setConnected(false);
                es?.close();
                if (!closed) retry = setTimeout(open, 10000);
            };
        };
        open();
        return () => {
            closed = true;
            if (retry) clearTimeout(retry);
            es?.close();
        };
    }, []);

    return { reading, connected, history };
}
