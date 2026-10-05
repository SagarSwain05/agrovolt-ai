'use client';

import React, { useState } from 'react';
import { marketExtraAPI, apiError } from '@/lib/api';
import { useI18n, cropKey } from '@/lib/i18n';
import { Megaphone, CheckCircle2 } from 'lucide-react';

export default function PriceReportForm({ crop, mandis, onDone }: { crop: string; mandis: string[]; onDone: () => void }) {
    const { t } = useI18n();
    const [mandi, setMandi] = useState('');
    const [price, setPrice] = useState('');
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await marketExtraAPI.report({ crop, mandi: mandi.trim(), price: Number(price) });
            setMsg({ ok: true, text: t('report.thanks') });
            setPrice(''); onDone();
        } catch (err) { setMsg({ ok: false, text: apiError(err) }); }
    };
    return (
        <form onSubmit={submit} className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, display: 'flex', gap: '0.4rem', alignItems: 'center' }}><Megaphone size={16} /> {t('report.title2', { crop: t(cropKey(crop)) })}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-gray-500)', margin: '0.25rem 0 0.75rem' }}>{t('report.sub2')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ alignItems: 'end' }}>
                <div>
                    <label className="label">{t('market.colMandi')}</label>
                    <input className="input" list="mandi-list" value={mandi} onChange={(e) => setMandi(e.target.value)} required placeholder="Khordha Mandi" />
                    <datalist id="mandi-list">{mandis.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
                <div>
                    <label className="label">{t('report.priceQ')}</label>
                    <input className="input" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
                <button className="btn-primary" type="submit">{t('report.submit')}</button>
            </div>
            {msg && <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: msg.ok ? 'var(--color-green-700)' : 'var(--color-red-600)', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>{msg.ok && <CheckCircle2 size={14} />} {msg.text}</div>}
        </form>
    );
}
