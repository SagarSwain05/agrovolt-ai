'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useI18n, cropKey } from '@/lib/i18n';
import { useFarm } from '@/lib/farm';
import { cropAPI, apiError } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { Wheat, Sprout, CalendarDays, Sun, Loader2, Plus, Droplets, CheckCircle2 } from 'lucide-react';

interface Rec {
    name: string; successRate: number; confidence: number; yield: number; revenue: number; waterReq: string; shadeTolerance: string;
    growthDays: number; soilMatch: string; rainfallMatch: string; factors: Record<string, number>; reasoning: string;
}
interface Crop { _id: string; cropName: string; season: string; sowingDate: string; expectedHarvestDate: string; predictedYield: number; status: string; healthScore: number }

const SOILS = ['loamy', 'clay', 'sandy', 'alluvial', 'red', 'black', 'laterite', 'silt'];
const STAGES = ['germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity'];

function currentSeason() {
    const m = new Date().getMonth() + 1;
    return m >= 6 && m <= 10 ? 'kharif' : m >= 11 || m <= 2 ? 'rabi' : 'zaid';
}

export default function CropsPage() {
    const { t, num, date } = useI18n();
    const { farm } = useFarm();
    const [soil, setSoil] = useState('loamy');
    const [rain, setRain] = useState(1450);
    const [season, setSeason] = useState(currentSeason());
    const [recs, setRecs] = useState<Rec[] | null>(null);
    const [excluded, setExcluded] = useState<{ name: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [adding, setAdding] = useState<Rec | null>(null);
    const [sow, setSow] = useState(new Date().toISOString().slice(0, 10));
    const [yieldQ, setYieldQ] = useState('');
    const crops = useApi<Crop[]>(() => cropAPI.getCrops(), []);

    useEffect(() => {
        if (farm) { setSoil(farm.soilType || 'loamy'); setRain(farm.annualRainfall || 1450); }
    }, [farm]);

    const recommend = async () => {
        setBusy(true); setErr(null);
        try {
            const r = await cropAPI.getRecommendations({ soilType: soil, rainfall: rain, season });
            setRecs(r.data.data.recommendations); setExcluded(r.data.data.excluded || []);
        } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (farm) recommend(); }, [farm?._id]);

    const addCrop = async () => {
        if (!adding) return;
        const harvest = new Date(new Date(sow).getTime() + adding.growthDays * 86400000).toISOString().slice(0, 10);
        try {
            await cropAPI.addCrop({ cropName: adding.name, season, sowingDate: sow, expectedHarvestDate: harvest, predictedYield: yieldQ ? Number(yieldQ) : undefined });
            setAdding(null); setYieldQ(''); crops.reload();
        } catch (e) { setErr(apiError(e)); }
    };

    const active = (crops.data || []).filter((c) => c.status !== 'harvested');
    const nextHarvest = useMemo(() => active.map((c) => c.expectedHarvestDate).filter(Boolean).sort()[0], [active]);

    const progress = (c: Crop) => {
        const s = new Date(c.sowingDate).getTime(), e = new Date(c.expectedHarvestDate).getTime();
        const p = Math.max(0, Math.min(1, (Date.now() - s) / Math.max(1, e - s)));
        return { p, stage: STAGES[Math.min(STAGES.length - 1, Math.floor(p * STAGES.length))], daysLeft: Math.max(0, Math.ceil((e - Date.now()) / 86400000)) };
    };

    return (
        <div>
            <Navbar title={t('nav.crops')} subtitle={t('crops.subtitle')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard variant="green" icon={<Wheat size={18} />} label={t('crops.active')} value={String(active.length)} />
                    <StatCard variant="solar" icon={<CalendarDays size={18} />} label={t('crops.nextHarvest')} value={nextHarvest ? date(nextHarvest) : '—'} />
                    <StatCard variant="green" icon={<Sprout size={18} />} label={t('crops.topPick')} value={recs?.[0] ? t(cropKey(recs[0].name)) : '—'} subValue={recs?.[0] ? `${Math.round(recs[0].confidence * 100)}%` : ''} />
                    <StatCard variant="blue" icon={<Sun size={18} />} label={t('crops.shade')} value={farm?.solarInstalled ? `${farm.shadeCoverage}%` : '0%'} subValue={t('season.' + season)} />
                </div>

                <div className="card">
                    <h2 style={h2}>{t('crops.recommendTitle')}</h2>
                    <p style={sub}>{t('crops.recommendSub')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3" style={{ alignItems: 'end' }}>
                        <div><label className="label">{t('settings.soil')}</label>
                            <select className="select" value={soil} onChange={(e) => setSoil(e.target.value)}>{SOILS.map((s) => <option key={s} value={s}>{t('soil.' + s)}</option>)}</select></div>
                        <div><label className="label">{t('settings.rainfall')}</label><input className="input" type="number" value={rain} onChange={(e) => setRain(Number(e.target.value) || 0)} /></div>
                        <div><label className="label">{t('crops.season')}</label>
                            <select className="select" value={season} onChange={(e) => setSeason(e.target.value)}>{['kharif', 'rabi', 'zaid'].map((s) => <option key={s} value={s}>{t('season.' + s)}</option>)}</select></div>
                        <button className="btn-primary" onClick={recommend} disabled={busy}>{busy ? t('common.loading') : t('crops.recommend')}</button>
                    </div>
                    {err && <div style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{err}</div>}
                </div>

                {recs && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {recs.map((r, i) => (
                            <div key={r.name} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: i === 0 ? '2px solid var(--color-green-400)' : undefined }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{t(cropKey(r.name))}</div>
                                    <span className="badge badge-green">{Math.round(r.confidence * 100)}%</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--color-gray-100)' }}><div style={{ width: `${r.confidence * 100}%`, height: '100%', borderRadius: 3, background: 'var(--color-green-500)' }} /></div>
                                <div className="grid grid-cols-2 gap-1" style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                                    <span>{t('crops.shadeTol')}: <b>{t('level.' + r.shadeTolerance.replace(/ /g, '_'))}</b></span>
                                    <span>{t('crops.water')}: <b>{t('level.' + r.waterReq.replace(/ /g, '_'))}</b></span>
                                    <span>{t('crops.days')}: <b>{r.growthDays}</b></span>
                                    <span>{t('crops.soilMatch')}: <b>{t('match.' + r.soilMatch)}</b></span>
                                    <span>{t('crops.yield')}: <b>{num(r.yield)} kg/ha</b></span>
                                    <span>{t('crops.rainMatch')}: <b>{t('match.' + r.rainfallMatch)}</b></span>
                                </div>
                                <button className="btn-secondary" onClick={() => setAdding(r)} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', fontSize: '0.8125rem' }}>
                                    <Plus size={14} /> {t('crops.addToFarm')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {excluded.length > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{t('crops.excluded', { season: t('season.' + season), list: excluded.map((e) => t(cropKey(e.name))).join(', ') })}</div>}

                {adding && (
                    <div className="card" style={{ border: '2px solid var(--color-green-300)' }}>
                        <h2 style={h2}>{t('crops.addTitle', { crop: t(cropKey(adding.name)) })}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginTop: '0.75rem', alignItems: 'end' }}>
                            <div><label className="label">{t('crops.sowing')}</label><input className="input" type="date" value={sow} onChange={(e) => setSow(e.target.value)} /></div>
                            <div><label className="label">{t('crops.expectedYield')}</label><input className="input" type="number" placeholder={t('crops.optional')} value={yieldQ} onChange={(e) => setYieldQ(e.target.value)} /></div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn-primary" onClick={addCrop}>{t('common.add')}</button>
                                <button className="btn-ghost" onClick={() => setAdding(null)}>{t('common.cancel')}</button>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>
                            {t('crops.harvestCalc', { d: date(new Date(new Date(sow).getTime() + adding.growthDays * 86400000), { day: 'numeric', month: 'short', year: 'numeric' }), n: adding.growthDays })}
                        </div>
                    </div>
                )}

                <div className="card">
                    <h2 style={h2}>{t('crops.myCrops')}</h2>
                    {crops.loading && !crops.data && <Loader2 size={16} className="animate-spin" />}
                    {crops.data && crops.data.length === 0 && <p style={sub}>{t('crops.noneYet')}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {(crops.data || []).map((c) => {
                            const pr = progress(c);
                            const done = c.status === 'harvested';
                            return (
                                <div key={c._id} style={{ padding: '0.875rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', opacity: done ? 0.6 : 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <Sprout size={16} color="var(--color-green-600)" />
                                        <b>{t(cropKey(c.cropName))}</b>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>· {t('season.' + c.season)} · {t('crops.sown', { d: date(c.sowingDate) })}</span>
                                        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{done ? t('crops.harvested') : t('stage.' + pr.stage)}</span>
                                    </div>
                                    {!done && (
                                        <>
                                            <div style={{ height: 8, borderRadius: 4, background: 'var(--color-gray-100)', margin: '0.625rem 0 0.375rem' }}>
                                                <div style={{ width: `${pr.p * 100}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--color-green-400), var(--color-solar-400))' }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-gray-600)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <span><Droplets size={11} style={{ display: 'inline' }} /> {t('crops.daysLeft', { n: pr.daysLeft, d: date(c.expectedHarvestDate) })}</span>
                                                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
                                                    onClick={async () => { await cropAPI.updateCrop(c._id, { status: 'harvested' }); crops.reload(); }}>
                                                    <CheckCircle2 size={12} /> {t('crops.markHarvested')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
