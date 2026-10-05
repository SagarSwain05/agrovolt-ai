'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { farmAPI, apiError } from './api';
import { useAuth } from './auth';

export interface Farm {
    _id: string;
    farmName: string;
    farmSize: number;
    soilType: string;
    location: { latitude: number; longitude: number; district?: string; state?: string; address?: string };
    solarInstalled: boolean;
    solarSince?: string;
    solarCapacityKW: number;
    panelCount: number;
    panelTilt: number;
    panelAzimuth: number;
    panelHeight: number;
    shadeCoverage: number;
    cropUnderPanels: string;
    tariffPerKwh: number;
    annualRainfall: number;
}

interface FarmCtx {
    farm: Farm | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    update: (patch: Partial<Farm> & { location?: Partial<Farm['location']> }) => Promise<Farm>;
}

const Ctx = createContext<FarmCtx | undefined>(undefined);

export function FarmProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [farm, setFarm] = useState<Farm | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await farmAPI.get();
            setFarm(res.data.data);
            setError(null);
        } catch (e) {
            setError(apiError(e));
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => { refresh(); }, [refresh]);

    const update = useCallback(async (patch: Partial<Farm> & { location?: Partial<Farm['location']> }) => {
        const res = await farmAPI.update(patch as Record<string, unknown>);
        setFarm(res.data.data);
        return res.data.data as Farm;
    }, []);

    return <Ctx.Provider value={{ farm, loading, error, refresh, update }}>{children}</Ctx.Provider>;
}

export function useFarm() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useFarm must be used within FarmProvider');
    return c;
}
