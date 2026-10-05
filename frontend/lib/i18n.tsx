'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { Lang } from './api';
import { DICT } from './i18n/dict';

// ═══════════════════════════════════════════════
// AgroVolt AI — UI translations (English / हिन्दी / ଓଡ଼ିଆ)
// t('key', { name: 'x' }) → string with {name} replaced.
// ═══════════════════════════════════════════════

export const LANGS: { code: Lang; label: string; short: string; speech: string }[] = [
    { code: 'en', label: 'English', short: 'EN', speech: 'en-IN' },
    { code: 'hi', label: 'हिन्दी', short: 'हि', speech: 'hi-IN' },
    { code: 'or', label: 'ଓଡ଼ିଆ', short: 'ଓ', speech: 'or-IN' },
];
const IDX: Record<Lang, number> = { en: 0, hi: 1, or: 2 };
const LANG_KEY = 'agrovolt_lang';

type Params = Record<string, string | number | null | undefined>;

interface I18nCtx {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string, params?: Params) => string;
    /** Locale-aware number formatting (Indian grouping) */
    num: (v: number | null | undefined, digits?: number) => string;
    /** Localised short date */
    date: (d: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
}

const Ctx = createContext<I18nCtx | undefined>(undefined);

export function translate(lang: Lang, key: string, params?: Params): string {
    const entry = DICT[key];
    // Dynamic keys (crop.X, wx.X, …) without an entry fall back to the readable value
    let s = entry ? (entry[IDX[lang]] || entry[0]) : key.includes('.') ? key.slice(key.indexOf('.') + 1).replace(/_/g, ' ') : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? '' : String(params[k])));
    return s;
}

const LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' };

export function LanguageProvider({ children, onChange }: { children: ReactNode; onChange?: (l: Lang) => void }) {
    const [lang, setLangState] = useState<Lang>('en');

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LANG_KEY) as Lang | null;
            if (saved && saved in IDX) { setLangState(saved); return; }
            const u = JSON.parse(localStorage.getItem('agrovolt_user') || 'null');
            if (u?.language && u.language in IDX) setLangState(u.language);
        } catch { /* storage unavailable */ }
    }, []);

    useEffect(() => {
        document.documentElement.lang = lang === 'or' ? 'or' : lang;
    }, [lang]);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
        onChange?.(l);
    }, [onChange]);

    const value = useMemo<I18nCtx>(() => ({
        lang,
        setLang,
        t: (key, params) => translate(lang, key, params),
        num: (v, digits = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })),
        date: (d, opts = { day: 'numeric', month: 'short' }) => {
            try { return new Date(d).toLocaleDateString(LOCALE[lang], opts); } catch { return String(d); }
        },
    }), [lang, setLang]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
    const c = useContext(Ctx);
    if (!c) throw new Error('useI18n must be used within LanguageProvider');
    return c;
}

/** Translation key for a crop name in any casing ('turmeric' → 'crop.Turmeric'). */
export function cropKey(name?: string | null) {
    if (!name || name.toLowerCase() === 'general') return 'crop.general';
    return 'crop.' + name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
