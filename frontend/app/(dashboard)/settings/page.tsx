'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import {
    User, MapPin, Sun, Globe, Bell, Shield, Save,
    Smartphone, Mail, Volume2,
} from 'lucide-react';

export default function SettingsPage() {
    const [name, setName] = useState('Sagar Swain');
    const [phone, setPhone] = useState('+91 7894561230');
    const [district, setDistrict] = useState('Khordha');
    const [state, setState] = useState('Odisha');
    const [farmSize, setFarmSize] = useState('2');
    const [soilType, setSoilType] = useState('loamy');
    const [panels, setPanels] = useState('12');
    const [capacity, setCapacity] = useState('5');
    const [language, setLanguage] = useState('en');
    const [notifications, setNotifications] = useState({
        weather: true,
        market: true,
        crop: true,
        solar: false,
        subsidy: true,
    });

    return (
        <div>
            <Navbar title="Settings" subtitle="Manage your profile, farm details & preferences" />

            <div className="page-container">
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* Profile */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            Profile
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label className="label">Full Name</label>
                                <input className="input" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="label">Phone</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" value={phone} onChange={e => setPhone(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
                                    <Smartphone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }} />
                                </div>
                            </div>
                            <div className="grid-2">
                                <div>
                                    <label className="label">District</label>
                                    <input className="input" value={district} onChange={e => setDistrict(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">State</label>
                                    <input className="input" value={state} onChange={e => setState(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Farm Details */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MapPin size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            Farm Details
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="grid-2">
                                <div>
                                    <label className="label">Farm Size (acres)</label>
                                    <input className="input" type="number" value={farmSize} onChange={e => setFarmSize(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">Soil Type</label>
                                    <select className="select" value={soilType} onChange={e => setSoilType(e.target.value)}>
                                        <option value="loamy">Loamy</option>
                                        <option value="sandy">Sandy</option>
                                        <option value="clayey">Clayey</option>
                                        <option value="red">Red Laterite</option>
                                        <option value="black">Black Cotton</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {/* Solar Config */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sun size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                            Solar Configuration
                        </h3>
                        <div className="grid-2">
                            <div>
                                <label className="label">Panel Count</label>
                                <input className="input" type="number" value={panels} onChange={e => setPanels(e.target.value)} />
                            </div>
                            <div>
                                <label className="label">Total Capacity (kW)</label>
                                <input className="input" type="number" value={capacity} onChange={e => setCapacity(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Language */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Globe size={20} strokeWidth={1.75} color="var(--color-blue-600)" />
                            Language
                        </h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[
                                { key: 'en', label: 'English', native: 'EN' },
                                { key: 'hi', label: 'हिंदी', native: 'HI' },
                                { key: 'or', label: 'ଓଡ଼ିଆ', native: 'OR' },
                            ].map(lang_ => (
                                <button
                                    key={lang_.key}
                                    onClick={() => setLanguage(lang_.key)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        borderRadius: 'var(--radius-xl)',
                                        border: language === lang_.key ? '2px solid var(--color-green-400)' : '1px solid var(--color-gray-200)',
                                        background: language === lang_.key ? 'var(--color-green-50)' : 'white',
                                        color: language === lang_.key ? 'var(--color-green-700)' : 'var(--color-gray-600)',
                                        fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                                        fontFamily: 'var(--font-body)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <div style={{ fontSize: '1rem', marginBottom: '0.125rem' }}>{lang_.label}</div>
                                    <div style={{ fontSize: '0.625rem', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>{lang_.native}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Bell size={20} strokeWidth={1.75} color="var(--color-solar-600)" />
                        Notifications
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {[
                            { key: 'weather', label: 'Weather Alerts', desc: 'Severe weather and irrigation reminders' },
                            { key: 'market', label: 'Market Price Updates', desc: 'Price spikes and AI sell signals' },
                            { key: 'crop', label: 'Crop Health Alerts', desc: 'Disease detection and care reminders' },
                            { key: 'solar', label: 'Solar Performance', desc: 'Efficiency drops and cleaning reminders' },
                            { key: 'subsidy', label: 'Subsidy Notifications', desc: 'New scheme announcements and deadlines' },
                        ].map(item => (
                            <div key={item.key} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.75rem',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--color-gray-50)',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-gray-700)' }}>{item.label}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>{item.desc}</div>
                                </div>
                                <button
                                    onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                                    style={{
                                        width: '40px', height: '22px', borderRadius: '11px',
                                        background: notifications[item.key as keyof typeof notifications]
                                            ? 'var(--color-green-500)' : 'var(--color-gray-300)',
                                        border: 'none', cursor: 'pointer', position: 'relative',
                                        transition: 'background 0.2s ease',
                                    }}
                                >
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                                        position: 'absolute', top: '2px',
                                        left: notifications[item.key as keyof typeof notifications] ? '20px' : '2px',
                                        transition: 'left 0.2s ease',
                                        boxShadow: 'var(--shadow-sm)',
                                    }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Save */}
                <button
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '200px' }}
                >
                    <Save size={16} /> Save Settings
                </button>
            </div>
        </div>
    );
}
