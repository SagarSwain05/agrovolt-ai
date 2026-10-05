'use client';
import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useI18n, cropKey } from '@/lib/i18n';
import { useFarm } from '@/lib/farm';
import { scanAPI, districtAPI, weatherAPI, cropAPI, apiError } from '@/lib/api';
import { speak } from '@/lib/speech';
import {
    ScanLine, Camera, Upload, Zap, AlertTriangle, CheckCircle2,
    Leaf, Sun, Microscope, Shield, Clock, Activity, FileSearch, Target,
    Eye, Cpu, CircleDollarSign, Flame, Radio, MapPin, Wind,
    AlertOctagon, TrendingDown, Crosshair, Box, Video, X,
} from 'lucide-react';

// ═══ Image validation: HSL hue-based pixel classification ═══
// Converts each pixel to HSL and classifies by hue range:
//   Green vegetation: H 55-165°, Saturation > 12%
//   Solar panel/metallic: H 180-260° or very low saturation (gray)
//   Skin tone: H 5-50°, S 15-75%, L 25-80%
// Requires a minimum % of pixels to match before accepting as valid
function validateImageLocally(dataUrl: string): Promise<{ valid: boolean; type: string; reason: string }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 120;
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            const totalPixels = data.length / 4;

            let greenVeg = 0;   // vegetation pixels
            let bluePanel = 0;  // metallic / blue-gray / dark pixels
            let skinTone = 0;   // human skin tone pixels
            let brightWall = 0; // neutral bright background (walls/ceilings)

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                const d = max - min;
                const l = (max + min) / 2;
                let h = 0, s = 0;
                if (d > 0.001) {
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
                    else if (max === g) h = ((b - r) / d + 2) * 60;
                    else h = ((r - g) / d + 4) * 60;
                }

                // 1. Skin Tone (Broadened to catch faces in shadow, beige walls)
                if (s > 0.10 && h >= 5 && h <= 50 && l > 0.15 && l < 0.85) {
                    skinTone++;
                }
                // 2. Crop Vegetation (Green)
                else if (s > 0.15 && h >= 60 && h <= 160 && l > 0.15 && l < 0.80) {
                    greenVeg++;
                }
                // 3. Solar Panel (Deep Blue or Near Black/Very Dark Gray)
                else if ((s >= 0.15 && h >= 190 && h <= 250 && l < 0.50) || (l < 0.20 && s < 0.20)) {
                    bluePanel++;
                }
                // 4. Irrelevant Wall/Background (Bright Neutral)
                else if (s < 0.15 && l > 0.40) {
                    brightWall++;
                }
            }

            const greenPct = (greenVeg / totalPixels) * 100;
            const panelPct = (bluePanel / totalPixels) * 100;
            const skinPct = (skinTone / totalPixels) * 100;
            const wallPct = (brightWall / totalPixels) * 100;

            // ── DECISION LOGIC ────────────────────────────────────
            // Priority: reject faces FIRST, then check for plants/panels

            // 1. Reject bright empty backgrounds (walls, ceilings, sky)
            if (wallPct > 60 && panelPct < 5 && greenPct < 5 && skinPct < 10) {
                resolve({ valid: false, type: 'unknown', reason: 'scan.v.background' });
                return;
            }

            // 2. HUMAN FACE REJECTION — multi-tier check
            //    KEY INSIGHT: In faces, skin pixels DOMINATE over green pixels.
            //    In diseased leaves, green is present even if brown/yellow dominates.
            //    A person with a green shirt/background still has skin > green ratio.

            // 2a. Strong skin detection (high skin, low green)
            if (skinPct > 18 && greenPct < 8) {
                resolve({ valid: false, type: 'unknown', reason: 'scan.v.person' });
                return;
            }

            // 2b. Skin-to-green RATIO check — if skin dominates green by 2x or more, 
            //     it's almost certainly a face/human, not a plant
            if (skinPct > 12 && skinPct > greenPct * 2) {
                resolve({ valid: false, type: 'unknown', reason: 'scan.v.person' });
                return;
            }

            // 2c. Moderate skin with almost zero green (face with dark background)
            if (skinPct > 10 && greenPct < 3 && panelPct < 5) {
                resolve({ valid: false, type: 'unknown', reason: 'scan.v.notPlant' });
                return;
            }

            // 3. CROP ACCEPTANCE — green vegetation must be meaningful
            //    DO NOT count skin pixels as "agricultural" — that was the old bug
            if (greenPct >= 8) {
                resolve({ valid: true, type: 'crop', reason: 'ok' });
                return;
            }

            // 3b. For diseased/brown leaves: some green + some brown/warm tones
            //     Only accept if green is at least HALF of skin (indicates actual plant material)
            if (greenPct >= 3 && skinPct > 5 && greenPct >= skinPct * 0.4) {
                resolve({ valid: true, type: 'crop', reason: 'ok' });
                return;
            }

            // 4. Accept if enough dark/blue panel pixels
            if (panelPct >= 10) {
                resolve({ valid: true, type: 'panel', reason: 'ok' });
                return;
            }

            // 5. Not enough evidence of plant or panel
            resolve({ valid: false, type: 'unknown', reason: 'scan.v.unknown' });
        };
        img.onerror = () => resolve({ valid: false, type: 'unknown', reason: 'scan.v.load' });
        img.src = dataUrl;
    });
}

interface HistoryScan { _id: string; cropName: string; detectedDisease: string; confidenceScore: number; severity: string; scannedAt: string; status: string }
interface Outbreak { disease: string; crop: string; farmsAffected: number; scans: number; alert: 'outbreak' | 'watch' | 'isolated'; lastSeen: string; districts: string[] }

function ScanPage() {
    const { t, num, date, lang } = useI18n();
    const { farm } = useFarm();
    const params = useSearchParams();
    const [mode, setMode] = useState<'crop' | 'panel'>(params.get('mode') === 'panel' ? 'panel' : 'crop');
    const [history, setHistory] = useState<HistoryScan[]>([]);
    const [outbreaks, setOutbreaks] = useState<Outbreak[] | null>(null);
    const [humidity, setHumidity] = useState<number | null>(null);
    const [growing, setGrowing] = useState<{ cropName: string; sowingDate: string }[]>([]);

    const loadHistory = useCallback(() => {
        scanAPI.history().then((r) => setHistory(r.data.data.scans || [])).catch(() => { });
    }, []);
    useEffect(() => {
        loadHistory();
        districtAPI.get().then((r) => setOutbreaks(r.data.data.outbreaks || [])).catch(() => setOutbreaks([]));
        cropAPI.getCrops().then((r) => setGrowing((r.data.data || []).filter((c: { status: string }) => c.status !== 'harvested'))).catch(() => { });
    }, [loadHistory]);
    useEffect(() => {
        if (!farm) return;
        weatherAPI.getCurrent(farm.location.latitude, farm.location.longitude).then((r) => setHumidity(r.data.data.humidity)).catch(() => { });
    }, [farm]);
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    // Removed crop selector — AI auto-detects crop from image
    const [cameraActive, setCameraActive] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // CROPS dropdown removed — detection is purely image-based now

    // ═══ KEY FIX: Connect stream → video AFTER React renders the <video> element ═══
    React.useEffect(() => {
        if (cameraActive && streamRef.current && videoRef.current) {
            const video = videoRef.current;
            video.srcObject = streamRef.current;
            video.onloadedmetadata = () => {
                video.play().then(() => setVideoReady(true)).catch(() => setVideoReady(true));
            };
            // If metadata already loaded (fast cameras), try playing immediately
            if (video.readyState >= 1) {
                video.play().then(() => setVideoReady(true)).catch(() => setVideoReady(true));
            }
        }
    }, [cameraActive]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const clearImage = useCallback(() => {
        setImage(null); setResult(null); setScanError(null);
        if (fileRef.current) fileRef.current.value = '';
    }, []);

    const startCamera = useCallback(async () => {
        try {
            setResult(null); setScanError(null); setVideoReady(false); setImage(null);
            // Try rear camera first, fall back to any available camera
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            // Store the stream, then toggle cameraActive → React renders <video> → useEffect connects them
            streamRef.current = stream;
            setCameraActive(true);
        } catch (err) {
            setScanError(t('scan.err.camera'));
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraActive(false); setVideoReady(false);
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !videoReady) return;
        const v = videoRef.current, c = canvasRef.current;
        c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL('image/jpeg', 0.9);
        setImage(dataUrl);
        stopCamera();
    }, [videoReady, stopCamera]);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setResult(null); setScanError(null);
            const r = new FileReader();
            r.onload = (ev) => setImage(ev.target?.result as string);
            r.readAsDataURL(file);
        }
    };

    const handleScan = async () => {
        if (!image) { setScanError(t('scan.err.noImage')); return; }
        setScanning(true); setResult(null); setScanError(null);

        // Validate image content (reject clear non-plant images like human faces)
        const validation = await validateImageLocally(image);
        if (!validation.valid) {
            setScanError(t(validation.reason));
            setScanning(false);
            return;
        }

        // NOTE: Removed strict mode gatekeeper — diseased/spotted leaves with heavy brown areas
        // were being classified as 'unknown' and rejected. Roboflow is the final arbiter.
        // Only reject if the local validator is VERY confident it's the wrong type (panel in crop mode etc.)
        if (validation.type === 'panel' && mode === 'crop') {
            setScanError(t('scan.err.panelInCrop'));
            setScanning(false);
            return;
        }
        if (validation.type === 'crop' && mode === 'panel') {
            setScanError(t('scan.err.cropInPanel'));
            setScanning(false);
            return;
        }

        try {
            const res = mode === 'crop' ? await scanAPI.crop(image) : await scanAPI.panel(image);
            if (res.data.success) {
                setResult(res.data.data);
                if (mode === 'crop') loadHistory();
            } else {
                setScanError(res.data.message || t('scan.err.process'));
            }
        } catch (error) {
            setScanError(apiError(error, t('scan.err.connect')));
        } finally {
            setScanning(false);
        }
    };

    const sevColor = (s: string) => s === 'Severe' || s === 'Critical' ? 'var(--color-red-500)' : s === 'Moderate' || s === 'High' || s === 'Medium' ? 'var(--color-solar-600)' : 'var(--color-green-600)';

    return (
        <div>
            <Navbar title={t('nav.scan')} subtitle={t('scan.subtitle')} />
            <div className="page-container">
                {/* Mode Toggle + Crop Select */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.375rem', padding: '0.25rem', borderRadius: 'var(--radius-full)', background: 'var(--color-gray-100)', width: 'max-content' }}>
                        {[{ key: 'crop', label: t('scan.modeCrop'), icon: <Leaf size={14} /> }, { key: 'panel', label: t('scan.modePanel'), icon: <Sun size={14} /> }].map(tab => (
                            <button key={tab.key} onClick={() => { setMode(tab.key as any); setResult(null); setImage(null); }} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: 'none', background: mode === tab.key ? 'white' : 'transparent', color: mode === tab.key ? 'var(--color-green-700)' : 'var(--color-gray-500)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontFamily: 'var(--font-body)', boxShadow: mode === tab.key ? 'var(--shadow-sm)' : 'none' }}>{tab.icon} {tab.label}</button>
                        ))}
                    </div>
                    {/* Crop dropdown removed — AI auto-detects crop from the image */}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: '1.25rem' }}>
                    {/* ═══ CAMERA VIEWFINDER ═══ */}
                    <div className="card">
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Eye size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            {cameraActive ? t('scan.viewfinder') : mode === 'crop' ? t('scan.scanCrop') : t('scan.scanPanel')}
                        </h3>

                        <div style={{ position: 'relative', border: '2px solid var(--color-gray-200)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--color-gray-900)', minHeight: '260px', marginBottom: '0.625rem' }}>
                            {cameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '260px', objectFit: 'cover' }} />
                                    {/* Viewfinder corners */}
                                    {[{ top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 }].map((pos, i) => (
                                        <div key={i} style={{ position: 'absolute', ...pos as any, width: 28, height: 28, borderTop: i < 2 ? '3px solid rgba(34,197,94,0.9)' : 'none', borderBottom: i >= 2 ? '3px solid rgba(34,197,94,0.9)' : 'none', borderLeft: i % 2 === 0 ? '3px solid rgba(34,197,94,0.9)' : 'none', borderRight: i % 2 === 1 ? '3px solid rgba(34,197,94,0.9)' : 'none', borderRadius: '4px' }} />
                                    ))}
                                    {/* Shutter — only when video ready */}
                                    {videoReady && (
                                        <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 56, height: 56, borderRadius: '50%', border: '3px solid white', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'white' }} />
                                        </button>
                                    )}
                                    {!videoReady && (
                                        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>{t('scan.initCamera')}</div>
                                    )}
                                    <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={14} color="white" />
                                    </button>
                                </>
                            ) : image ? (
                                <div style={{ position: 'relative' }}>
                                    <img src={image} alt="Captured" style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }} />
                                    {/* Delete button */}
                                    <button onClick={clearImage} style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                        <X size={14} color="white" />
                                    </button>
                                    {/* Bounding Boxes overlay */}
                                    {result?.bboxes?.map((b: any, i: number) => (
                                        <div key={i} style={{ position: 'absolute', left: `${b.x1}%`, top: `${b.y1}%`, width: `${b.w}%`, height: `${b.h}%`, border: '2px solid #EF4444', borderRadius: 3, background: 'rgba(239,68,68,0.1)' }}>
                                            <span style={{ position: 'absolute', top: -16, left: 0, fontSize: '0.5rem', background: '#EF4444', color: 'white', padding: '1px 4px', borderRadius: 2, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                                {result.disease || result.defect} {b.conf}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div onClick={() => fileRef.current?.click()} style={{ padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer', background: mode === 'crop' ? 'var(--color-green-50)' : 'var(--color-solar-50)', height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <Upload size={28} color="var(--color-gray-400)" style={{ marginBottom: '0.5rem' }} />
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-gray-600)' }}>{t('scan.tapUpload')}</div>
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-400)', marginTop: '0.25rem' }}>
                                        {mode === 'crop' ? t('scan.hintCrop') : t('scan.hintPanel')}
                                    </div>
                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-300)', marginTop: '0.5rem', fontStyle: 'italic' }}>{t('scan.validates')}</div>
                                </div>
                            )}
                        </div>
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} />

                        {/* Scan Error Message */}
                        {scanError && (
                            <div style={{ marginBottom: '0.5rem', padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: '0.125rem' }}>{t('scan.notRecognized')}</div>
                                    <div style={{ fontSize: '0.6875rem', color: '#991B1B' }}>{scanError}</div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={startCamera} style={{ flex: 1, padding: '0.625rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)', background: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', color: 'var(--color-gray-600)' }}>
                                <Camera size={16} /> {t('scan.camera')}
                            </button>
                            <button onClick={handleScan} className="btn-primary" disabled={scanning} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                                {scanning ? <><Activity size={14} /> {t('scan.analyzing')}</> : <><Crosshair size={14} /> {mode === 'crop' ? t('scan.detectDisease') : t('scan.detectDefect')}</>}
                            </button>
                        </div>

                        {/* Pipeline Progress (shows during/after scan) */}
                        {result?.pipeline && (
                            <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-gray-500)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Cpu size={10} /> {t('scan.pipeline')}</div>
                                {result.pipeline.map((s: any) => (
                                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.625rem', padding: '0.2rem 0', color: 'var(--color-gray-600)' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--color-green-100)', color: 'var(--color-green-700)', fontSize: '0.5rem', fontWeight: 700 }}>{s.stage}</span>
                                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                                        <span style={{ color: 'var(--color-gray-400)' }}>→</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green-700)' }}>{s.result}</span>
                                        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--color-gray-400)' }}>{s.ms}ms</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ═══ DIAGNOSIS RESULTS ═══ */}
                    <div className="card" style={{ background: result ? 'white' : 'var(--color-gray-50)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Microscope size={20} strokeWidth={1.75} color="var(--color-green-600)" />
                            {t('scan.diagnosis')}
                        </h3>

                        {!result ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>
                                <ScanLine size={40} strokeWidth={1} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                                <p style={{ fontSize: '0.875rem' }}>{t('scan.emptyTitle')}</p>
                                <p style={{ fontSize: '0.6875rem', marginTop: '0.25rem' }}>{t('scan.emptySub')}</p>
                                <p style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gray-300)', marginTop: '0.5rem' }}>PlantDoc · Roboflow</p>
                            </div>
                        ) : mode === 'crop' && result.disease ? (
                            <div>
                                {/* Confidence + Disease */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(${sevColor(result.severity)} ${result.confidence}%, var(--color-gray-100) ${result.confidence}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: sevColor(result.severity) }}>{result.confidence}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{result.disease === 'Healthy' ? `✅ ${t('scan.healthy')}` : result.disease}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>{result.pathogen}</div>
                                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                                            <span className={`badge ${result.severity === 'Severe' ? 'badge-red' : result.severity === 'Moderate' ? 'badge-solar' : 'badge-green'}`} style={{ fontSize: '0.375rem' }}>{result.severity}</span>
                                            <span className="badge badge-default" style={{ fontSize: '0.375rem' }}>{result.cls}</span>
                                            <span className="badge badge-default" style={{ fontSize: '0.375rem' }}>{t('scan.area')}: {result.affectedArea}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Economic Impact */}
                                {result.rupeeRisk > 0 && (
                                    <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '1px solid #F59E0B', marginBottom: '0.625rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#92400E', marginBottom: '0.25rem' }}><CircleDollarSign size={12} /> {t('scan.econ')}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#92400E' }}>₹{result.rupeeRisk.toLocaleString()}</span>
                                                <span style={{ fontSize: '0.6875rem', color: '#92400E', marginLeft: '0.25rem' }}>{t('common.perQuintal')}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.6875rem', color: '#92400E' }}>{t('scan.yieldRisk')}: <strong>-{result.yieldLoss}%</strong></div>
                                                <div style={{ fontSize: '0.5625rem', color: '#92400E' }}>{t('scan.spread')}: {result.spread}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button className="btn-secondary" onClick={() => speak([result.disease === 'Healthy' ? t('scan.healthy') : result.disease, result.symptoms, ...(result.treatment || []).slice(0, 2), result.organic ? `${t('scan.organic')}: ${result.organic}` : ''].filter(Boolean).join('. '), lang)}
                                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', marginBottom: '0.625rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Radio size={12} /> {t('dash.listen')}
                                </button>
                                {/* Treatment */}
                                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-gray-600)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('scan.treatment')}</div>
                                {result.treatment.map((s: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', padding: '0.3rem 0', borderBottom: i < result.treatment.length - 1 ? '1px solid var(--color-gray-50)' : 'none', fontSize: '0.75rem', color: 'var(--color-gray-600)' }}>
                                        <CheckCircle2 size={13} color="var(--color-green-500)" style={{ marginTop: 2, flexShrink: 0 }} /> {s}
                                    </div>
                                ))}
                                <div style={{ marginTop: '0.375rem', padding: '0.375rem', borderRadius: 'var(--radius-md)', background: 'var(--color-green-50)', fontSize: '0.6875rem', color: 'var(--color-green-700)' }}>
                                    🌿 <strong>{t('scan.organic')}:</strong> {result.organic}
                                </div>
                            </div>
                        ) : result?.defect ? (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: `conic-gradient(${sevColor(result.severity)} ${result.confidence}%, var(--color-gray-100) ${result.confidence}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: sevColor(result.severity) }}>{result.confidence}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--color-gray-800)' }}>{result.defect}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)' }}>{result.symptoms}</div>
                                        <span className={`badge ${result.severity === 'Critical' ? 'badge-red' : result.severity === 'High' ? 'badge-solar' : 'badge-green'}`} style={{ fontSize: '0.375rem', marginTop: '0.125rem' }}>{result.severity}</span>
                                    </div>
                                </div>
                                {/* Panel Economic Impact */}
                                <div style={{ padding: '0.625rem', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '1px solid #F59E0B', marginBottom: '0.625rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>{t('scan.dailyLoss')}</div>
                                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, color: '#92400E' }}>₹{result.dailyLoss}</span>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>{t('scan.monthly')}</div>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: '#92400E' }}>₹{(result.dailyLoss * 30).toLocaleString()}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>{t('scan.effDrop')}</div>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: '#EF4444' }}>-{result.effLoss}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-gray-600)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{t('scan.action')}</div>
                                {result.action.map((s: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', padding: '0.3rem 0', fontSize: '0.75rem', color: s.startsWith('⚠') ? 'var(--color-red-600)' : 'var(--color-gray-600)', fontWeight: s.startsWith('⚠') ? 700 : 400 }}>
                                        <Shield size={13} color="var(--color-green-500)" style={{ marginTop: 2, flexShrink: 0 }} /> {s}
                                    </div>
                                ))}
                                <div style={{ marginTop: '0.375rem', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gray-400)' }}>{t('scan.detection')}: {result.method}</div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* ═══ BOTTOM ROW: Context + Outbreak + History (live) ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: '1.5rem' }}>
                    <div className="card" style={{ padding: '0.875rem' }}>
                        <h4 style={h4}><Target size={16} color="var(--color-green-600)" /> {t('scan.context')}</h4>
                        <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--color-green-50)', marginBottom: '0.5rem' }}>
                            <div style={kicker}>{t('scan.growing')}</div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-gray-700)', marginTop: '0.125rem' }}>
                                {growing.length ? growing.map((c) => `${t(cropKey(c.cropName))} (${t('scan.day', { n: Math.max(0, Math.floor((Date.now() - new Date(c.sowingDate).getTime()) / 86400000)) })})`).join(' · ') : t('scan.noCrops')}
                            </div>
                        </div>
                        {humidity != null && (
                            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: humidity >= 80 ? '#FEF3C7' : 'var(--color-gray-50)' }}>
                                <div style={{ ...kicker, color: '#92400E', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Wind size={10} /> {t('scan.weatherRisk')}</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400E', marginTop: '0.125rem' }}>
                                    {humidity >= 80 ? t('scan.fungalHigh', { h: humidity }) : t('scan.fungalLow', { h: humidity })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: '0.875rem' }}>
                        <h4 style={h4}><Radio size={16} color="var(--color-red-500)" /> {t('district.radar')}</h4>
                        {outbreaks === null ? <Activity size={14} /> : outbreaks.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-green-700)' }}>{t('district.noOutbreak')}</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                {outbreaks.slice(0, 4).map((a) => (
                                    <div key={a.disease + a.crop} style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: a.alert === 'outbreak' ? '#FEE2E2' : a.alert === 'watch' ? '#FEF3C7' : 'var(--color-gray-50)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, gap: '0.5rem' }}>
                                            <span>{a.disease}</span><span>{t('district.alert.' + a.alert)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.625rem', color: 'var(--color-gray-500)', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                            <MapPin size={9} /> {t(cropKey(a.crop))} · {t('scan.outbreakShort', { f: a.farmsAffected, s: a.scans })} · {date(a.lastSeen)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: '0.875rem' }}>
                        <h4 style={h4}><Clock size={16} color="var(--color-gray-500)" /> {t('scan.recent')}</h4>
                        {history.length === 0 ? <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{t('scan.noHistory')}</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {history.slice(0, 6).map((h) => {
                                    const healthy = /healthy/i.test(h.detectedDisease);
                                    return (
                                        <div key={h._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderRadius: 'var(--radius-md)', background: 'var(--color-gray-50)', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
                                                <Leaf size={14} color={healthy ? 'var(--color-green-500)' : 'var(--color-solar-600)'} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{healthy ? t('scan.healthy') : h.detectedDisease}</div>
                                                    <div style={{ fontSize: '0.5625rem', color: 'var(--color-gray-400)' }}>{t(cropKey(h.cropName))} · {date(h.scannedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gray-500)' }}>{num(h.confidenceScore)}%</div>
                                                {!healthy && h.status === 'pending' && (
                                                    <button onClick={async () => { await scanAPI.updateStatus(h._id, 'treated'); loadHistory(); }} style={{ fontSize: '0.5625rem', border: 'none', background: 'none', color: 'var(--color-green-700)', cursor: 'pointer', padding: 0 }}>{t('scan.markTreated')}</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-green-50)', border: '1px solid var(--color-green-200)', fontSize: '0.6875rem', color: 'var(--color-green-700)', lineHeight: 1.7 }}>
                    {t('scan.method')}
                </div>
            </div>
        </div>
    );
}

const h4: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-gray-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' };
const kicker: React.CSSProperties = { fontSize: '0.5625rem', fontWeight: 700, color: 'var(--color-green-700)', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default function ScanPageRoute() {
    return <Suspense fallback={null}><ScanPage /></Suspense>;
}
