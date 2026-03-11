'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
    LayoutDashboard,
    Wheat,
    Zap,
    BarChart3,
    Leaf,
    ScanLine,
    IndianRupee,
    FileText,
    Landmark,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
} from 'lucide-react';

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/crops', icon: Wheat, label: 'Crop Intelligence' },
    { href: '/solar', icon: Zap, label: 'Solar Optimization' },
    { href: '/market', icon: BarChart3, label: 'Market Intelligence' },
    { href: '/carbon', icon: Leaf, label: 'Carbon Wallet' },
    { href: '/scan', icon: ScanLine, label: 'Scan Hub' },
    { href: '/profit', icon: IndianRupee, label: 'Profit Tracker' },
    { href: '/reports', icon: FileText, label: 'AI Reports' },
    { href: '/subsidies', icon: Landmark, label: 'Subsidies' },
    { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    // ── KEY FIX: Update the CSS variable so the main content area resizes ──
    useEffect(() => {
        document.documentElement.style.setProperty(
            '--sidebar-width',
            collapsed ? '72px' : '260px'
        );
    }, [collapsed]);

    return (
        <aside
            className={`sidebar hidden md:flex md:flex-col ${collapsed ? 'sidebar-collapsed' : ''}`}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: collapsed ? '72px' : '260px',
                background: 'linear-gradient(180deg, #064e3b 0%, #047857 40%, #059669 100%)',
                zIndex: 50,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
            }}
        >
            {/* Logo */}
            <div
                style={{
                    padding: '1.25rem 1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    minHeight: '64px',
                }}
            >
                <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #34d399 0%, #fbbf24 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: '0 2px 8px rgba(52,211,153,0.3)',
                }}>
                    <Zap size={20} strokeWidth={2.5} color="#064e3b" />
                </div>
                {!collapsed && (
                    <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'white', fontSize: '1.125rem', letterSpacing: '-0.02em' }}>
                            AgroVolt AI
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontFamily: 'var(--font-body)' }}>
                            Bio-Solar Intelligence
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const IconComp = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
                                    borderRadius: 'var(--radius-lg)',
                                    textDecoration: 'none',
                                    color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                                    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: '0.8125rem',
                                    transition: 'all 0.2s ease',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    fontFamily: 'var(--font-body)',
                                    letterSpacing: '0.01em',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <IconComp size={18} strokeWidth={isActive ? 2 : 1.75} style={{ flexShrink: 0 }} />
                                {!collapsed && <span>{item.label}</span>}
                                {isActive && !collapsed && (
                                    <div
                                        style={{
                                            marginLeft: 'auto',
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            background: '#34d399',
                                            boxShadow: '0 0 8px rgba(52, 211, 153, 0.6)',
                                        }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* User Section */}
            <div
                style={{
                    padding: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                {!collapsed && user && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.5rem 0.625rem',
                            borderRadius: 'var(--radius-lg)',
                            background: 'rgba(255,255,255,0.08)',
                            marginBottom: '0.5rem',
                        }}
                    >
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #34d399, #3b82f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0,
                            }}
                        >
                            {user.name?.charAt(0)?.toUpperCase() || 'F'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ color: 'white', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user.name || 'Farmer'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6875rem' }}>
                                {user.role || 'farmer'}
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            title="Logout"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '4px' }}
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                )}

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 'var(--radius-md)',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                        fontFamily: 'var(--font-body)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                >
                    {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Collapse</>}
                </button>
            </div>
        </aside>
    );
}
