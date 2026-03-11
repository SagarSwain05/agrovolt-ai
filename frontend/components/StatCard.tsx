'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue?: string;
    trend?: 'up' | 'down';
    trendValue?: string;
    variant?: 'default' | 'green' | 'solar' | 'blue' | 'red';
}

export default function StatCard({ icon, label, value, subValue, trend, trendValue, variant = 'default' }: StatCardProps) {
    const accentColors: Record<string, { bg: string; iconBg: string; trend: string }> = {
        default: { bg: 'white', iconBg: 'var(--color-gray-100)', trend: 'var(--color-gray-600)' },
        green: { bg: 'white', iconBg: 'var(--color-green-50)', trend: 'var(--color-green-600)' },
        solar: { bg: 'white', iconBg: 'var(--color-solar-50)', trend: 'var(--color-solar-600)' },
        blue: { bg: 'white', iconBg: 'var(--color-blue-50)', trend: 'var(--color-blue-600)' },
        red: { bg: 'white', iconBg: 'var(--color-red-50)', trend: 'var(--color-red-600)' },
    };

    const colors = accentColors[variant] || accentColors.default;

    return (
        <div
            className="card"
            style={{
                background: colors.bg,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                animation: 'scaleIn 0.3s ease forwards',
                /* ALIGNMENT FIX: equal min-height so all cards line up */
                minHeight: '120px',
                justifyContent: 'space-between',
                overflow: 'hidden',
                wordBreak: 'break-word' as const,
            }}
        >
            {/* Top row — Icon + Trend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                <div
                    style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-lg)',
                        background: colors.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colors.trend,
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </div>
                {trend && trendValue && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            fontSize: 'clamp(0.625rem, 2.5vw, 0.75rem)',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            color: trend === 'up' ? 'var(--color-green-600)' : 'var(--color-red-500)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {trend === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {trendValue}
                    </div>
                )}
            </div>

            {/* Value */}
            <div style={{ minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.125rem, 4vw, 1.5rem)',
                    fontWeight: 700,
                    color: 'var(--color-gray-900)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {value}
                </div>
                <div style={{
                    fontSize: 'clamp(0.6875rem, 2.5vw, 0.8125rem)',
                    color: 'var(--color-gray-500)',
                    marginTop: '0.125rem',
                    fontFamily: 'var(--font-body)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {label}
                </div>
                {subValue && (
                    <div style={{
                        fontSize: 'clamp(0.5625rem, 2vw, 0.6875rem)',
                        color: 'var(--color-gray-400)',
                        fontFamily: 'var(--font-body)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {subValue}
                    </div>
                )}
            </div>
        </div>
    );
}
