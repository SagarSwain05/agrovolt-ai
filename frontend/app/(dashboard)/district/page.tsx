'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import StatCard from '@/components/StatCard';
import { useI18n, cropKey } from '@/lib/i18n';
import { useFarm } from '@/lib/farm';
import { districtAPI } from '@/lib/api';
import { useApi } from '@/hooks/useLive';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Sun, Droplets, Leaf, Radar, AlertTriangle, Cpu, Loader2 } from 'lucide-react';

interface District {
    scope: { district: string | null; state: string };
    districts: { name: string; farms: number }[];
    farms: { total: number; withSolar: number; areaAcres: number; capacityKW: number; withIoT: number };
    last30: { energyKwh: number; waterSavedL: number; co2AvoidedKg: number; bioCoolingGainPct: number; daily: { day: string; kwh: number; water: number }[] };
    carbon: { credits: number; co2Kg: number; waterL: number };
    outbreaks: { disease: string; crop: string; scans: number; farmsAffected: number; districts: string[]; avgConfidence: number; severeCases: number; lastSeen: string; alert: 'outbreak' | 'watch' | 'isolated' }[];
}

const ALERT_STYLE = {
    outbreak: { bg: 'var(--color-red-50)', color: 'var(--color-red-600)' },
    watch: { bg: 'var(--color-solar-50)', color: 'var(--color-solar-700)' },
    isolated: { bg: 'var(--color-gray-50)', color: 'var(--color-gray-600)' },
};

export default function DistrictPage() {
    const { t, num, date } = useI18n();
    const { farm } = useFarm();
    const [district, setDistrict] = useState<string | undefined>(undefined);
    const { data, loading } = useApi<District>(() => districtAPI.get(district, farm?.location?.state), [district, farm?.location?.state], 300000);
    const scopeName = data?.scope.district || data?.scope.state || '';

    return (
        <div>
            <Navbar title={t('nav.district')} subtitle={t('district.subtitle', { scope: scopeName })} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {data && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label className="label" style={{ margin: 0 }}>{t('district.scope')}</label>
                        <select className="select" style={{ width: 'auto' }} value={district ?? data.scope.district ?? ''} onChange={(e) => setDistrict(e.target.value)}>
                            <option value="">{t('district.allState', { s: data.scope.state })}</option>
                            {data.districts.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.farms})</option>)}
                        </select>
                    </div>
                )}
                {loading && !data && <div className="card" style={{ display: 'flex', gap: '0.5rem' }}><Loader2 size={16} className="animate-spin" /> {t('common.loading')}</div>}
                {data && (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard variant="green" icon={<Users size={18} />} label={t('district.farms')} value={num(data.farms.total)}
                                subValue={t('district.farmsSub', { s: data.farms.withSolar, a: num(data.farms.areaAcres, 1) })} />
                            <StatCard variant="solar" icon={<Sun size={18} />} label={t('district.energy30')} value={`${num(data.last30.energyKwh)} kWh`}
                                subValue={t('district.capacity', { kw: num(data.farms.capacityKW, 1), g: data.last30.bioCoolingGainPct })} />
                            <StatCard variant="blue" icon={<Droplets size={18} />} label={t('district.water30')} value={`${num(data.last30.waterSavedL)} L`} subValue={t('dash.byPanelShade')} />
                            <StatCard variant="green" icon={<Leaf size={18} />} label={t('district.credits')} value={num(data.carbon.credits, 2)}
                                subValue={`${num(data.carbon.co2Kg)} kg CO₂ · ${t('district.iot', { n: data.farms.withIoT })}`} />
                        </div>

                        <div className="card">
                            <h2 style={h2}><Radar size={16} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('district.radar')}</h2>
                            <p style={sub}>{t('district.radarSub')}</p>
                            {data.outbreaks.length === 0 ? (
                                <div style={{ fontSize: '0.875rem', color: 'var(--color-green-700)', background: 'var(--color-green-50)', padding: '0.75rem', borderRadius: 'var(--radius-lg)' }}>{t('district.noOutbreak')}</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {data.outbreaks.map((o) => {
                                        const st = ALERT_STYLE[o.alert];
                                        return (
                                            <div key={o.disease + o.crop} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: st.bg, flexWrap: 'wrap' }}>
                                                <AlertTriangle size={18} color={st.color} />
                                                <div style={{ flex: 1, minWidth: 200 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{o.disease} · {t(cropKey(o.crop))}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                                                        {t('district.outbreakLine', { f: o.farmsAffected, s: o.scans, c: o.avgConfidence, d: date(o.lastSeen) })}{o.districts.length ? ` · ${o.districts.join(', ')}` : ''}
                                                    </div>
                                                </div>
                                                <span className="badge" style={{ background: 'white', color: st.color }}>{t('district.alert.' + o.alert)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h2 style={h2}>{t('district.trend')}</h2>
                            <div style={{ height: 220, marginTop: '0.5rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.last30.daily.map((d) => ({ ...d, label: date(d.day) }))} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={16} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(v, n) => [n === 'kwh' ? `${v} kWh` : `${v} L`, n === 'kwh' ? t('dash.energy') : t('carbon.waterSaved')]} />
                                        <Area dataKey="kwh" stroke="#d97706" fill="#fde68a" fillOpacity={0.5} />
                                        <Area dataKey="water" stroke="#2563eb" fill="#bfdbfe" fillOpacity={0.4} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <Cpu size={12} /> {t('district.privacy')}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-900)' };
const sub: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' };
