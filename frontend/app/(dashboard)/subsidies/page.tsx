'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import {
    Landmark, CheckCircle2, XCircle, ArrowRight, Shield,
    BrainCircuit, FileText, ExternalLink, IndianRupee, Zap,
    Users, MapPin, AlertCircle, ClipboardCheck,
} from 'lucide-react';

export default function SubsidiesPage() {
    const [checked, setChecked] = useState(false);

    const schemes = [
        {
            name: 'PM-KUSUM Component B',
            ministry: 'MNRE',
            desc: 'Standalone solar-powered agricultural pumps for individual farmers',
            subsidy: '60%',
            maxAmount: '₹72,000',
            eligible: true,
            criteria: [
                { label: 'Land ownership ≥ 2 acres', met: true },
                { label: 'Existing diesel/electric pump', met: true },
                { label: 'State: Odisha — covered', met: true },
                { label: 'Not previously availed', met: true },
            ],
        },
        {
            name: 'PM-KUSUM Component A',
            ministry: 'MNRE',
            desc: 'Solar power plants of capacity up to 2 MW on barren/fallow land',
            subsidy: '30%',
            maxAmount: '₹3,50,000',
            eligible: false,
            criteria: [
                { label: 'Land ownership ≥ 5 acres', met: false },
                { label: 'Barren/fallow land available', met: false },
                { label: 'State: Odisha — covered', met: true },
            ],
        },
        {
            name: 'Agrivoltaic Pilot Scheme',
            ministry: 'ICAR',
            desc: 'Research & demonstration of dual-use agrivoltaic systems',
            subsidy: '50%',
            maxAmount: '₹1,50,000',
            eligible: true,
            criteria: [
                { label: 'Existing solar installation', met: true },
                { label: 'Growing crops under panels', met: true },
                { label: 'Data sharing agreement', met: true },
            ],
        },
    ];

    return (
        <div>
            <Navbar title="Government Subsidies" subtitle="AI-powered eligibility checker for solar & agricultural schemes" />

            <div className="page-container">
                {/* AI Eligibility Button */}
                <div style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-2xl)',
                    background: 'linear-gradient(135deg, var(--color-green-800), #1e3a5f)',
                    color: 'white',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <BrainCircuit size={20} />
                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>1-Click AI Eligibility Check</span>
                        </div>
                        <p style={{ fontSize: '0.875rem', opacity: 0.8, maxWidth: '480px', lineHeight: 1.5 }}>
                            AI parses your profile (2 acres, Khordha, Odisha) against all active government schemes to find what you qualify for.
                        </p>
                    </div>
                    <button
                        onClick={() => setChecked(true)}
                        style={{
                            padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)',
                            background: checked ? 'rgba(255,255,255,0.2)' : 'white',
                            color: checked ? 'white' : 'var(--color-green-700)',
                            border: 'none', fontWeight: 700, fontSize: '0.875rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontFamily: 'var(--font-body)',
                        }}
                    >
                        {checked ? <><CheckCircle2 size={16} /> Checked</> : <><ClipboardCheck size={16} /> Check Eligibility</>}
                    </button>
                </div>

                {/* Schemes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {schemes.map((scheme, i) => (
                        <div key={scheme.name} className="card" style={{
                            border: scheme.eligible && checked ? '2px solid var(--color-green-300)' : '1px solid var(--color-gray-100)',
                            animation: checked ? `fadeIn 0.3s ease ${i * 0.1}s forwards` : 'none',
                            animationFillMode: 'backwards',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <Landmark size={18} color={scheme.eligible ? 'var(--color-green-600)' : 'var(--color-gray-400)'} />
                                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{scheme.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', color: 'var(--color-gray-400)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Shield size={10} /> {scheme.ministry}</span>
                                    </div>
                                </div>
                                {checked && (
                                    <span className={`badge ${scheme.eligible ? 'badge-green' : 'badge-default'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {scheme.eligible ? <><CheckCircle2 size={12} /> Eligible</> : <><XCircle size={12} /> Not Eligible</>}
                                    </span>
                                )}
                            </div>

                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-600)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{scheme.desc}</p>

                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-green-50)' }}>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Subsidy</div>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-green-700)' }}>{scheme.subsidy}</div>
                                </div>
                                <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-solar-50)' }}>
                                    <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>Max Amount</div>
                                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-solar-700)' }}>{scheme.maxAmount}</div>
                                </div>
                            </div>

                            {/* Criteria */}
                            {checked && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {scheme.criteria.map(c => (
                                        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: c.met ? 'var(--color-green-600)' : 'var(--color-gray-400)' }}>
                                            {c.met ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                            {c.label}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {scheme.eligible && checked && (
                                <button style={{
                                    marginTop: '0.75rem', padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-full)',
                                    background: 'var(--color-green-600)', border: 'none',
                                    color: 'white', fontWeight: 600, fontSize: '0.8125rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                                    fontFamily: 'var(--font-body)',
                                }}>
                                    Apply Now <ExternalLink size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
