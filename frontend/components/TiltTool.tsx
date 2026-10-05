'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Camera, CameraOff, Smartphone, Save, CheckCircle2 } from 'lucide-react';

interface Props {
    currentTilt: number;
    optimalTilt: number;
    sunAltitude?: number; // degrees, for the sky visual
    onSave?: (tilt: number) => Promise<void>;
}

/**
 * Sun-Chaser tilt tool.
 * - Inclinometer: lay the phone flat on the panel surface; DeviceOrientation β
 *   gives the panel's tilt from horizontal.
 * - AR view: rear camera with the optimal-angle guide drawn over the panel.
 */
export default function TiltTool({ currentTilt, optimalTilt, sunAltitude, onSave }: Props) {
    const { t } = useI18n();
    const [measured, setMeasured] = useState<number | null>(null);
    const [measuring, setMeasuring] = useState(false);
    const [camera, setCamera] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const alignedRef = useRef(false);

    const tilt = measured ?? currentTilt;
    const diff = Math.round((optimalTilt - tilt) * 10) / 10;
    const aligned = Math.abs(diff) <= 1;

    // Vibrate once when the user reaches alignment
    useEffect(() => {
        if (measured == null) return;
        if (aligned && !alignedRef.current) navigator.vibrate?.([60, 40, 60]);
        alignedRef.current = aligned;
    }, [aligned, measured]);

    useEffect(() => {
        if (!measuring) return;
        const onOrient = (e: DeviceOrientationEvent) => {
            if (e.beta == null) return;
            // Phone lying on the panel: |β| is the inclination from horizontal (0–90°)
            const b = Math.abs(e.beta);
            setMeasured(Math.round(Math.min(90, b > 90 ? 180 - b : b) * 10) / 10);
        };
        window.addEventListener('deviceorientation', onOrient);
        return () => window.removeEventListener('deviceorientation', onOrient);
    }, [measuring]);

    const startMeasure = async () => {
        setMsg(null);
        // iOS 13+ needs an explicit permission request from a user gesture
        const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
        try {
            if (DOE?.requestPermission) {
                const r = await DOE.requestPermission();
                if (r !== 'granted') { setMsg(t('tilt.permDenied')); return; }
            }
        } catch { setMsg(t('tilt.permDenied')); return; }
        if (!('DeviceOrientationEvent' in window)) { setMsg(t('tilt.noSensor')); return; }
        setMeasuring(true);
        setTimeout(() => setMeasured((m) => { if (m == null) setMsg(t('tilt.noSensor')); return m; }), 2500);
    };

    const toggleCamera = async () => {
        if (camera) {
            streamRef.current?.getTracks().forEach((tr) => tr.stop());
            streamRef.current = null;
            setCamera(false);
            return;
        }
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            streamRef.current = s;
            setCamera(true);
            setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => { }); } }, 50);
            if (!measuring) startMeasure();
        } catch {
            setMsg(t('tilt.camDenied'));
        }
    };

    useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

    // Panel visual geometry
    const W = 300, H = 170, px = 150, py = 130, len = 110;
    const line = (deg: number) => {
        const r = (deg * Math.PI) / 180;
        return { x1: px - (len / 2) * Math.cos(r), y1: py + (len / 2) * Math.sin(r), x2: px + (len / 2) * Math.cos(r), y2: py - (len / 2) * Math.sin(r) };
    };
    const cur = line(tilt), opt = line(optimalTilt);
    const alt = Math.max(0, Math.min(90, sunAltitude ?? 45));
    const sunX = W - 40 - (alt / 90) * 120, sunY = H - 20 - (alt / 90) * (H - 40);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: camera ? '#000' : 'linear-gradient(180deg, #e0f2fe 0%, #f0fdf4 100%)' }}>
                {camera && <video ref={videoRef} playsInline muted style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />}
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: camera ? 220 : 'auto', position: camera ? 'absolute' : 'static', inset: 0 }}>
                    {!camera && <circle cx={sunX} cy={sunY} r={12} fill="#fbbf24" opacity={0.9} />}
                    {!camera && <line x1={0} y1={py + 18} x2={W} y2={py + 18} stroke="#86efac" strokeWidth={6} />}
                    <line {...opt} stroke="#10b981" strokeWidth={camera ? 4 : 3} strokeDasharray="6 5" />
                    <line {...cur} stroke={aligned ? '#10b981' : '#f59e0b'} strokeWidth={camera ? 6 : 8} strokeLinecap="round" />
                    {!camera && <line x1={px} y1={py} x2={px} y2={py + 18} stroke="#6b7280" strokeWidth={3} />}
                    <text x={10} y={16} fontSize={11} fill={camera ? '#fff' : '#374151'} fontWeight={700}>{t('tilt.current')}: {tilt}°</text>
                    <text x={10} y={31} fontSize={11} fill={camera ? '#a7f3d0' : '#059669'} fontWeight={700}>{t('tilt.optimal')}: {optimalTilt}°</text>
                </svg>
            </div>

            <div style={{
                padding: '0.75rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', fontWeight: 700, fontSize: '0.9375rem',
                background: aligned ? 'var(--color-green-50)' : 'var(--color-solar-50)', color: aligned ? 'var(--color-green-700)' : 'var(--color-solar-700)',
            }}>
                {aligned ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CheckCircle2 size={16} /> {t('tilt.aligned')}</span>
                    : diff > 0 ? t('tilt.raise', { d: Math.abs(diff) }) : t('tilt.lower', { d: Math.abs(diff) })}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={measuring ? () => setMeasuring(false) : startMeasure} style={btn}>
                    <Smartphone size={15} /> {measuring ? t('tilt.stopMeasure') : t('tilt.measure')}
                </button>
                <button className="btn-secondary" onClick={toggleCamera} style={btn}>
                    {camera ? <CameraOff size={15} /> : <Camera size={15} />} {camera ? t('tilt.cameraOff') : t('tilt.cameraOn')}
                </button>
                {onSave && measured != null && (
                    <button className="btn-primary" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(Math.round(measured)); setMsg(t('tilt.savedMsg', { t: Math.round(measured) })); } finally { setSaving(false); } }} style={btn}>
                        <Save size={15} /> {saving ? t('common.saving') : t('tilt.save', { t: Math.round(measured) })}
                    </button>
                )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', lineHeight: 1.5 }}>{msg || t('tilt.howTo')}</div>
        </div>
    );
}

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', padding: '0.5rem 0.875rem' };
