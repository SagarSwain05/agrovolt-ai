// Open-Meteo relay used by the backend when its shared egress IP is throttled (HTTP 429).
// Only forecast parameters are forwarded; responses are CDN-cached for 15 minutes.
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED = new Set(['latitude', 'longitude', 'timezone', 'current', 'hourly', 'daily', 'forecast_days', 'past_days', 'models', 'cell_selection']);

export async function GET(req: NextRequest) {
    const key = process.env.WEATHER_PROXY_KEY;
    if (key && req.headers.get('x-proxy-key') !== key) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const q = new URLSearchParams();
    req.nextUrl.searchParams.forEach((v, k) => { if (ALLOWED.has(k)) q.set(k, v.slice(0, 600)); });
    if (!q.get('latitude') || !q.get('longitude')) return NextResponse.json({ error: 'latitude and longitude required' }, { status: 400 });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { next: { revalidate: 900 } });
    const body = await r.text();
    return new NextResponse(body, {
        status: r.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': r.ok ? 'public, s-maxage=900, stale-while-revalidate=3600' : 'no-store' },
    });
}
