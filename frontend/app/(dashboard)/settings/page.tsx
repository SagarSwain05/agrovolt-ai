'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuth } from '@/lib/auth';
import { useFarm, type Farm } from '@/lib/farm';
import { useI18n, cropKey } from '@/lib/i18n';
import { farmAPI, iotAPI, apiError, API_BASE } from '@/lib/api';
import { User, MapPin, Sun, Cpu, Crosshair, Search, Copy, Trash2, Plus, CheckCircle2, Loader2 } from 'lucide-react';

const SOILS = ['loamy', 'clay', 'sandy', 'alluvial', 'red', 'black', 'laterite', 'silt'];
const UNDERSTORY = ['general', 'turmeric', 'ginger', 'spinach', 'lettuce', 'tomato', 'chili', 'potato', 'onion', 'groundnut', 'millet', 'rice'];

interface Device { _id: string; name: string; type: string; keyPrefix: string; lastSeenAt?: string; createdAt: string }

export default function SettingsPage() {
    const { user, updateUser } = useAuth();
    const { farm, update, loading } = useFarm();
    const { t, date } = useI18n();

    const [profile, setProfile] = useState({ name: '', phone: '' });
    const [f, setF] = useState<Partial<Farm>>({});
    const [loc, setLoc] = useState<{ latitude?: number; longitude?: number; district?: string; state?: string }>({});
    const [q, setQ] = useState('');
    const [results, setResults] = useState<{ label: string; latitude: number; longitude: number; district: string; state: string }[]>([]);
    const [status, setStatus] = useState<Record<string, string>>({});
    const [devices, setDevices] = useState<Device[]>([]);
    const [newKey, setNewKey] = useState<{ name: string; apiKey: string } | null>(null);
    const [devName, setDevName] = useState('');

    useEffect(() => { if (user) setProfile({ name: user.name, phone: user.phone || '' }); }, [user]);
    useEffect(() => {
        if (!farm) return;
        setF({
            farmName: farm.farmName, farmSize: farm.farmSize, soilType: farm.soilType, solarInstalled: farm.solarInstalled,
            solarCapacityKW: farm.solarCapacityKW, panelCount: farm.panelCount, panelTilt: farm.panelTilt, panelAzimuth: farm.panelAzimuth,
            shadeCoverage: farm.shadeCoverage, cropUnderPanels: farm.cropUnderPanels, tariffPerKwh: farm.tariffPerKwh,
            annualRainfall: farm.annualRainfall, solarSince: farm.solarSince ? farm.solarSince.slice(0, 10) : undefined,
        });
        setLoc({ ...farm.location });
    }, [farm]);
    useEffect(() => { iotAPI.devices().then((r) => setDevices(r.data.data)).catch(() => { }); }, []);

    const setS = (k: string, v: string) => setStatus((s) => ({ ...s, [k]: v }));

    const saveProfile = async () => {
        setS('profile', 'saving');
        try {
            const r = await farmAPI.updateMe(profile);
            updateUser({ name: r.data.data.name, phone: r.data.data.phone });
            setS('profile', 'saved');
        } catch (e) { setS('profile', apiError(e)); }
    };

    const saveFarm = async (section: string, patch: Record<string, unknown>) => {
        setS(section, 'saving');
        try { await update(patch); setS(section, 'saved'); } catch (e) { setS(section, apiError(e)); }
    };

    const search = async () => {
        if (!q.trim()) return;
        setS('search', 'saving');
        try { const r = await farmAPI.geocode(q); setResults(r.data.data); setS('search', ''); } catch (e) { setS('search', apiError(e)); }
    };

    const useGps = () => {
        if (!navigator.geolocation) return setS('location', t('settings.noGps'));
        setS('location', 'saving');
        navigator.geolocation.getCurrentPosition(
            (p) => { setLoc((l) => ({ ...l, latitude: Math.round(p.coords.latitude * 1e5) / 1e5, longitude: Math.round(p.coords.longitude * 1e5) / 1e5 })); setS('location', ''); },
            () => setS('location', t('settings.gpsDenied')),
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    const addDevice = async () => {
        try {
            const r = await iotAPI.registerDevice(devName || 'Field node');
            setNewKey({ name: r.data.data.name, apiKey: r.data.data.apiKey });
            setDevName('');
            const d = await iotAPI.devices(); setDevices(d.data.data);
        } catch (e) { setS('devices', apiError(e)); }
    };

    if (loading || !farm) return <div><Navbar title={t('nav.settings')} /><div className="page-container"><Loader2 className="animate-spin" size={18} /></div></div>;

    const num = (k: keyof Farm) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value === '' ? undefined : Number(e.target.value) }));

    return (
        <div>
            <Navbar title={t('nav.settings')} subtitle={t('settings.subtitle')} />
            <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 980 }}>

                <Section icon={<User size={18} />} title={t('settings.profile')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label={t('settings.name')}><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
                        <Field label={t('settings.phone')}><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field>
                        <Field label={t('settings.email')}><input className="input" value={user?.email || ''} disabled /></Field>
                        <Field label={t('common.language')}><div><LanguageSwitcher full /></div></Field>
                    </div>
                    <SaveRow status={status.profile} onSave={saveProfile} />
                </Section>

                <Section icon={<MapPin size={18} />} title={t('settings.farm')}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label={t('settings.farmName')}><input className="input" value={f.farmName || ''} onChange={(e) => setF({ ...f, farmName: e.target.value })} /></Field>
                        <Field label={t('settings.farmSize')}><input className="input" type="number" step="0.1" value={f.farmSize ?? ''} onChange={num('farmSize')} /></Field>
                        <Field label={t('settings.soil')}>
                            <select className="select" value={f.soilType} onChange={(e) => setF({ ...f, soilType: e.target.value })}>
                                {SOILS.map((s) => <option key={s} value={s}>{t('soil.' + s)}</option>)}
                            </select>
                        </Field>
                        <Field label={t('settings.rainfall')}><input className="input" type="number" value={f.annualRainfall ?? ''} onChange={num('annualRainfall')} /></Field>
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', fontWeight: 600 }}>{t('settings.location')}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder={t('settings.searchPlace')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
                        <button className="btn-secondary" onClick={search} style={iconBtn}><Search size={14} /> {t('settings.search')}</button>
                        <button className="btn-secondary" onClick={useGps} style={iconBtn}><Crosshair size={14} /> {t('settings.useGps')}</button>
                    </div>
                    {results.length > 0 && (
                        <div style={{ marginTop: '0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            {results.map((r) => (
                                <button key={r.label} onClick={() => { setLoc({ latitude: r.latitude, longitude: r.longitude, district: r.district, state: r.state }); setResults([]); }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: 'none', borderBottom: '1px solid var(--color-gray-100)', background: 'white', cursor: 'pointer' }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: '0.5rem' }}>
                        <Field label={t('settings.district')}><input className="input" value={loc.district || ''} onChange={(e) => setLoc({ ...loc, district: e.target.value })} /></Field>
                        <Field label={t('settings.state')}><input className="input" value={loc.state || ''} onChange={(e) => setLoc({ ...loc, state: e.target.value })} /></Field>
                        <Field label={t('settings.lat')}><input className="input" type="number" step="0.00001" value={loc.latitude ?? ''} onChange={(e) => setLoc({ ...loc, latitude: Number(e.target.value) })} /></Field>
                        <Field label={t('settings.lon')}><input className="input" type="number" step="0.00001" value={loc.longitude ?? ''} onChange={(e) => setLoc({ ...loc, longitude: Number(e.target.value) })} /></Field>
                    </div>
                    <SaveRow status={status.farm || status.location} onSave={() => saveFarm('farm', { farmName: f.farmName, farmSize: f.farmSize, soilType: f.soilType, annualRainfall: f.annualRainfall, location: loc })} />
                </Section>

                <Section icon={<Sun size={18} />} title={t('settings.solar')}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!f.solarInstalled} onChange={(e) => setF({ ...f, solarInstalled: e.target.checked })} /> {t('settings.solarInstalled')}
                    </label>
                    {f.solarInstalled && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: '0.75rem' }}>
                            <Field label={t('settings.capacity')}><input className="input" type="number" step="0.1" value={f.solarCapacityKW ?? ''} onChange={num('solarCapacityKW')} /></Field>
                            <Field label={t('settings.panels')}><input className="input" type="number" value={f.panelCount ?? ''} onChange={num('panelCount')} /></Field>
                            <Field label={t('settings.tilt')}><input className="input" type="number" value={f.panelTilt ?? ''} onChange={num('panelTilt')} /></Field>
                            <Field label={t('settings.azimuth')}><input className="input" type="number" value={f.panelAzimuth ?? ''} onChange={num('panelAzimuth')} /></Field>
                            <Field label={t('settings.shade')}><input className="input" type="number" min={0} max={90} value={f.shadeCoverage ?? ''} onChange={num('shadeCoverage')} /></Field>
                            <Field label={t('settings.understory')}>
                                <select className="select" value={f.cropUnderPanels} onChange={(e) => setF({ ...f, cropUnderPanels: e.target.value })}>
                                    {UNDERSTORY.map((c) => <option key={c} value={c}>{t(cropKey(c))}</option>)}
                                </select>
                            </Field>
                            <Field label={t('settings.tariff')}><input className="input" type="number" step="0.1" value={f.tariffPerKwh ?? ''} onChange={num('tariffPerKwh')} /></Field>
                            <Field label={t('settings.since')}><input className="input" type="date" value={(f.solarSince as string) || ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, solarSince: e.target.value })} /></Field>
                        </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>{t('settings.solarNote')}</div>
                    <SaveRow status={status.solar} onSave={() => saveFarm('solar', {
                        solarInstalled: f.solarInstalled, solarCapacityKW: f.solarCapacityKW, panelCount: f.panelCount, panelTilt: f.panelTilt,
                        panelAzimuth: f.panelAzimuth, shadeCoverage: f.shadeCoverage, cropUnderPanels: f.cropUnderPanels, tariffPerKwh: f.tariffPerKwh,
                        ...(f.solarSince ? { solarSince: f.solarSince } : {}),
                    })} />
                </Section>

                <div id="devices" />
                <Section icon={<Cpu size={18} />} title={t('settings.devices')}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', lineHeight: 1.55 }}>{t('settings.devicesSub')}</p>
                    {devices.map((d) => (
                        <div key={d._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                            <Cpu size={16} color={d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 900000 ? 'var(--color-green-600)' : 'var(--color-gray-400)'} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>{d.keyPrefix}…</span></div>
                                <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{d.lastSeenAt ? t('settings.lastSeen', { d: date(d.lastSeenAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : t('settings.neverSeen')}</div>
                            </div>
                            <button className="btn-ghost" aria-label={t('common.delete')} onClick={async () => { await iotAPI.deleteDevice(d._id); setDevices(devices.filter((x) => x._id !== d._id)); }}><Trash2 size={14} /></button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder={t('settings.deviceName')} value={devName} onChange={(e) => setDevName(e.target.value)} />
                        <button className="btn-primary" onClick={addDevice} style={iconBtn}><Plus size={14} /> {t('settings.addDevice')}</button>
                    </div>
                    {status.devices && <div style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem' }}>{status.devices}</div>}
                    {newKey && (
                        <div style={{ marginTop: '0.75rem', padding: '0.875rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-900)', color: '#e5e7eb', fontSize: '0.75rem' }}>
                            <div style={{ color: '#fcd34d', fontWeight: 700, marginBottom: '0.375rem' }}>{t('settings.keyOnce')}</div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                                {newKey.apiKey}
                                <button onClick={() => navigator.clipboard?.writeText(newKey.apiKey)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }} aria-label="copy"><Copy size={14} /></button>
                            </div>
                            <pre style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#a7f3d0' }}>{`# HTTP POST every 5–15 min (ESP32 / LoRaWAN gateway)
curl -X POST ${API_BASE}/iot/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Key: ${newKey.apiKey}" \\
  -d '{"soilMoisturePct":31.5,"soilTempC":27.1,"soilN":210,"soilP":18,"soilK":160,
       "panelTempC":47.2,"ambientTempC":32.4,"humidityPct":61,"irradianceWm2":640,"powerW":2150}'`}</pre>
                            <div style={{ color: '#9ca3af', marginTop: '0.375rem' }}>{t('settings.keyFields')}</div>
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );

    function SaveRow({ status: st, onSave }: { status?: string; onSave: () => void }) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.875rem' }}>
                <button className="btn-primary" onClick={onSave} disabled={st === 'saving'}>{st === 'saving' ? t('common.saving') : t('common.save')}</button>
                {st === 'saved' && <span style={{ color: 'var(--color-green-600)', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={14} /> {t('common.saved')}</span>}
                {st && st !== 'saved' && st !== 'saving' && <span style={{ color: 'var(--color-red-600)', fontSize: '0.8125rem' }}>{st}</span>}
            </div>
        );
    }
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--color-green-600)' }}>{icon}</span> {title}
            </h2>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="label">{label}</label>{children}</div>;
}

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' };
