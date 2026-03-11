'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ScanLine,
    BarChart3,
    User,
    Wheat,
    Zap,
    Leaf,
    IndianRupee,
    ChevronUp,
    ChevronDown,
    FileText,
    Landmark,
    Settings,
} from 'lucide-react';

/* Primary tabs always visible (5 items) */
const primaryItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/crops', icon: Wheat, label: 'Crops' },
    { href: '/scan', icon: ScanLine, label: 'Scan', isFab: true },
    { href: '/solar', icon: Zap, label: 'Solar' },
    { href: '/market', icon: BarChart3, label: 'Market' },
];

/* Overflow items that slide up in a drawer */
const moreItems = [
    { href: '/carbon', icon: Leaf, label: 'Carbon' },
    { href: '/profit', icon: IndianRupee, label: 'Profit' },
    { href: '/reports', icon: FileText, label: 'Reports' },
    { href: '/subsidies', icon: Landmark, label: 'Subsidies' },
    { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
    const pathname = usePathname();
    const [showMore, setShowMore] = useState(false);
    const isMoreActive = moreItems.some(i => pathname === i.href);

    return (
        <>
            {/* Overflow drawer */}
            {showMore && (
                <div
                    className="md:hidden fixed bottom-[70px] left-0 w-full z-50 animate-fadeIn"
                    style={{
                        background: 'white',
                        borderTop: '1px solid #e5e7eb',
                        boxShadow: '0 -8px 30px rgba(0,0,0,0.1)',
                        borderRadius: '16px 16px 0 0',
                    }}
                >
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '0.25rem',
                            padding: '0.75rem 0.5rem',
                        }}
                    >
                        {moreItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setShowMore(false)}
                                    className="flex flex-col items-center justify-center py-2"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div
                                        className="flex items-center justify-center p-1.5 rounded-full transition-colors"
                                        style={{
                                            background: isActive ? 'var(--color-green-50)' : 'transparent',
                                            color: isActive ? 'var(--color-green-600)' : '#9ca3af',
                                        }}
                                    >
                                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                    </div>
                                    <span
                                        className="text-[10px] font-medium mt-0.5"
                                        style={{ color: isActive ? 'var(--color-green-600)' : '#6b7280' }}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Backdrop */}
            {showMore && (
                <div
                    className="md:hidden fixed inset-0 z-40"
                    style={{ background: 'rgba(0,0,0,0.2)' }}
                    onClick={() => setShowMore(false)}
                />
            )}

            {/* Main bottom bar */}
            <nav
                className="flex md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 px-1 pt-1 justify-around items-end"
                style={{
                    height: '68px',
                    paddingBottom: 'env(safe-area-inset-bottom, 8px)',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
                }}
            >
                {primaryItems.map((item) => {
                    const isActive = pathname === item.href;

                    if (item.isFab) {
                        return (
                            <div key={item.href} className="relative flex flex-col items-center justify-center z-50" style={{ marginTop: '-28px' }}>
                                <Link
                                    href={item.href}
                                    className="flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform active:scale-95"
                                    style={{
                                        background: isActive
                                            ? 'linear-gradient(135deg, #10b981, #059669)'
                                            : '#059669',
                                        color: 'white',
                                        boxShadow: isActive ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                                        textDecoration: 'none',
                                    }}
                                >
                                    <item.icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                                </Link>
                                <span
                                    className="text-[10px] mt-1 font-semibold"
                                    style={{ color: isActive ? 'var(--color-green-600)' : '#6b7280' }}
                                >
                                    {item.label}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center justify-center mb-1"
                            style={{ textDecoration: 'none', width: '56px' }}
                        >
                            <div
                                className="flex items-center justify-center p-1.5 rounded-full transition-colors"
                                style={{
                                    background: isActive ? 'var(--color-green-50)' : 'transparent',
                                    color: isActive ? 'var(--color-green-600)' : '#9ca3af',
                                }}
                            >
                                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span
                                className="text-[10px] font-medium mt-0.5"
                                style={{ color: isActive ? 'var(--color-green-600)' : '#6b7280' }}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* More button — opens the drawer with remaining items */}
                <button
                    onClick={() => setShowMore(!showMore)}
                    className="flex flex-col items-center justify-center mb-1"
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        width: '56px',
                        padding: 0,
                    }}
                >
                    <div
                        className="flex items-center justify-center p-1.5 rounded-full transition-colors"
                        style={{
                            background: showMore || isMoreActive ? 'var(--color-green-50)' : 'transparent',
                            color: showMore || isMoreActive ? 'var(--color-green-600)' : '#9ca3af',
                        }}
                    >
                        {showMore ? <ChevronDown size={22} strokeWidth={2} /> : <ChevronUp size={22} strokeWidth={2} />}
                    </div>
                    <span
                        className="text-[10px] font-medium mt-0.5"
                        style={{ color: showMore || isMoreActive ? 'var(--color-green-600)' : '#6b7280' }}
                    >
                        More
                    </span>
                </button>
            </nav>
        </>
    );
}
