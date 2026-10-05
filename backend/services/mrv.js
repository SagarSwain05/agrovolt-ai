'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — MRV (Measurement, Reporting & Verification) audit dataset
// Produces an auditable record for a farm and period:
//  • baseline grid emission factor + source, all formulas used
//  • daily rows with provenance (device-metered vs modelled), irradiance,
//    temperature, panel temperature, tilt in force, CO₂ and water saved
//  • hourly generation log (device telemetry if present, else model from
//    Open-Meteo hourly irradiance)
//  • tilt-change history, calibration factors, dataset SHA-256
// Exported as JSON, CSV (daily / hourly) and PDF.
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const SolarData = require('../models/SolarData');
const TiltLog = require('../models/TiltLog');
const Telemetry = require('../models/Telemetry');
const physics = require('./agrivoltaicPhysics');
const weather = require('./weatherService');
const ipcc = require('../data/ipcc_factors.json');

const GRID_EF = Number(process.env.GRID_EF_KG_PER_KWH) || physics.GRID_EF_KG_PER_KWH;
const EF_SOURCE = process.env.GRID_EF_SOURCE || 'India grid weighted-average emission factor as configured in ipcc_factors.json (update to the latest CEA CO2 Baseline Database value before registry submission)';
const IST = 5.5 * 3600e3;

function tiltAt(logs, day, fallback) {
    let t = fallback;
    for (const l of logs) if (new Date(l.at).getTime() + IST <= new Date(day + 'T23:59:59Z').getTime()) t = l.tiltDeg;
    return t;
}

async function build(farm, user, { from, to } = {}) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400e3);
    const [rows, logs] = await Promise.all([
        SolarData.find({ farmId: farm._id, date: { $gte: start, $lte: end }, isPartial: { $ne: true } }).sort({ date: 1 }).lean(),
        TiltLog.find({ farmId: farm._id }).sort({ at: 1 }).lean(),
    ]);
    const shadedArea = farm.solarCapacityKW * physics.GROUND_AREA_M2_PER_KW;
    const daily = rows.map((r) => {
        const day = r.day || r.date.toISOString().slice(0, 10);
        const co2 = (r.energyProduced || 0) * GRID_EF;
        return {
            date: day, source: r.source === 'device' ? 'metered' : 'modelled', energy_kwh: round(r.energyProduced, 3),
            irradiance_kwh_m2: round(r.irradianceKwhM2, 3), tmax_c: r.ambientTempMax ?? null, panel_temp_c: r.panelTemperature ?? null,
            tilt_deg: tiltAt(logs, day, farm.panelTilt), bio_cooling_c: r.bioCoolingDeltaC ?? null,
            co2_avoided_kg: round(co2, 3), water_saved_l: r.waterSavedLiters ?? null, revenue_inr: r.revenue ?? null,
        };
    });
    const totals = daily.reduce((t, d) => ({
        kwh: t.kwh + (d.energy_kwh || 0), metered_kwh: t.metered_kwh + (d.source === 'metered' ? d.energy_kwh : 0),
        co2: t.co2 + (d.co2_avoided_kg || 0), water: t.water + (d.water_saved_l || 0),
    }), { kwh: 0, metered_kwh: 0, co2: 0, water: 0 });

    const report = {
        reportId: `MRV-${String(farm._id).slice(-6).toUpperCase()}-${start.toISOString().slice(0, 10).replace(/-/g, '')}-${end.toISOString().slice(0, 10).replace(/-/g, '')}`,
        generatedAt: new Date().toISOString(),
        project: {
            farmCode: `AV-${String(farm._id).slice(-6).toUpperCase()}`, owner: user?.name, district: farm.location.district, state: farm.location.state,
            latitude: farm.location.latitude, longitude: farm.location.longitude, areaAcres: farm.farmSize,
            capacityKWp: farm.solarCapacityKW, panelCount: farm.panelCount, azimuthDeg: farm.panelAzimuth, commissioned: farm.solarSince,
            understoryCrop: farm.cropUnderPanels, shadeCoveragePct: farm.shadeCoverage, hardwareVerified: !!farm.isHardwareVerified,
        },
        period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days: daily.length, meteredDays: daily.filter((d) => d.source === 'metered').length },
        baseline: { gridEmissionFactorKgPerKwh: GRID_EF, source: EF_SOURCE, ipccReference: ipcc.methodology || null },
        methodology: {
            energy: 'E_day = P_rated(kWp) × PSH(kWh/m²) × PR(0.80) × η_temp × η_tilt;  η_temp = 1 − 0.004 × (T_cell − 25 °C);  T_cell = T_amb + (G/800) × 25 − ΔT_bio',
            metered: 'Metered days use the RS485 energy-meter register delta (or device daily total) and override the model.',
            irradianceCalibration: `Modelled PSH × ${farm.calibration?.irradianceFactor ?? 1} (NASA POWER observed ÷ Open-Meteo modelled over ${farm.calibration?.irradianceDays ?? 0} days)`,
            emissions: `CO2_avoided(kg) = E_day(kWh) × ${GRID_EF} kg/kWh`,
            water: `W_saved(L) = ET0(mm) × A_shaded(m²) × 0.30;  A_shaded = ${farm.solarCapacityKW} kWp × ${physics.GROUND_AREA_M2_PER_KW} m²/kWp = ${round(shadedArea, 1)} m²  (1 mm on 1 m² = 1 L; 30 % lower soil evaporation under panels vs open field)`,
            waterBaselineOpenField: `Open-field evaporation over the same area = ET0 × ${round(shadedArea, 1)} m²; reduction ratio applied = 0.30`,
            credits: '1 credit = 1 tCO2e avoided',
        },
        totals: { energyKwh: round(totals.kwh, 2), meteredKwh: round(totals.metered_kwh, 2), co2AvoidedKg: round(totals.co2, 2), credits: round(totals.co2 / 1000, 4), waterSavedL: Math.round(totals.water) },
        calibration: farm.calibration || null,
        tiltHistory: logs.map((l) => ({ at: l.at, tiltDeg: l.tiltDeg, optimalDeg: l.optimalDeg, source: l.source })),
        daily,
    };
    report.datasetSha256 = crypto.createHash('sha256').update(JSON.stringify({ p: report.project, d: report.daily, b: report.baseline })).digest('hex');
    return report;
}

/** Hourly generation log: device telemetry when present, otherwise modelled. */
async function hourly(farm, { from, to } = {}) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400e3);
    const days = Math.min(92, Math.ceil((Date.now() - start.getTime()) / 86400e3) + 1);
    const [om, dev] = await Promise.all([
        weather.getOpenMeteo(farm.location.latitude, farm.location.longitude, days),
        Telemetry.aggregate([
            { $match: { farmId: farm._id, source: 'device', ts: { $gte: start, $lte: end }, powerW: { $ne: null } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H', date: { $add: ['$ts', IST] } } }, w: { $avg: '$powerW' }, t: { $avg: '$panelTempC' } } },
        ]),
    ]);
    const devBy = Object.fromEntries(dev.map((d) => [d._id, d]));
    const tf = physics.tiltFactor(farm.panelTilt, require('../mlModels/solarPosition').getOptimalTilt(farm.location.latitude, farm.location.longitude));
    const k = farm.calibration?.irradianceFactor || 1;
    const fromS = start.toISOString().slice(0, 10), toS = end.toISOString().slice(0, 10);
    const out = [];
    om.hourly.time.forEach((ts, i) => {
        const d = ts.slice(0, 10);
        if (d < fromS || d > toS || ts > om.current.time) return;
        const G = (om.hourly.shortwave_radiation[i] || 0) * k;
        const T = om.hourly.temperature_2m[i];
        const key = ts.slice(0, 13);
        if (devBy[key]) {
            out.push({ hour: ts, source: 'metered', irradiance_wm2: Math.round(G), ambient_c: T, panel_temp_c: round(devBy[key].t, 1), energy_kwh: round(devBy[key].w / 1000, 3), tilt_deg: farm.panelTilt });
        } else {
            const pt = physics.panelTemperature(T, G, farm.cropUnderPanels, farm.shadeCoverage ?? 35);
            const w = physics.instantPowerW({ capacityKW: farm.solarCapacityKW, irradianceWm2: G, panelTempC: pt.cooled, tiltFactor: tf });
            out.push({ hour: ts, source: 'modelled', irradiance_wm2: Math.round(G), ambient_c: T, panel_temp_c: round(pt.cooled, 1), energy_kwh: round(w / 1000, 3), tilt_deg: farm.panelTilt });
        }
    });
    return out;
}

function toCsv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function toPdf(report, stream) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `AgroVolt MRV ${report.reportId}` } });
    doc.pipe(stream);
    const h = (t) => doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor('#064e3b').text(t).moveDown(0.2).font('Helvetica').fontSize(9).fillColor('#111');
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#047857').text('AgroVolt AI — MRV Audit Report');
    doc.font('Helvetica').fontSize(9).fillColor('#555').text(`${report.reportId} · generated ${report.generatedAt}`);
    h('1. Project');
    const p = report.project;
    doc.text(`Farm ${p.farmCode} · ${p.owner || ''} · ${p.district || ''}, ${p.state || ''} (${p.latitude}, ${p.longitude})`);
    doc.text(`Array ${p.capacityKWp} kWp, ${p.panelCount} panels, azimuth ${p.azimuthDeg}°, commissioned ${p.commissioned ? new Date(p.commissioned).toISOString().slice(0, 10) : 'n/a'}; understory ${p.understoryCrop}, shade ${p.shadeCoveragePct}%`);
    doc.text(`Hardware-verified metering: ${p.hardwareVerified ? 'YES' : 'NO (modelled)'}`);
    h('2. Reporting period & totals');
    doc.text(`${report.period.from} → ${report.period.to} · ${report.period.days} days (${report.period.meteredDays} metered)`);
    const t = report.totals;
    doc.text(`Energy ${t.energyKwh} kWh (metered ${t.meteredKwh} kWh) · CO2 avoided ${t.co2AvoidedKg} kg = ${t.credits} tCO2e · water saved ${t.waterSavedL} L`);
    h('3. Baseline');
    doc.text(`Grid emission factor: ${report.baseline.gridEmissionFactorKgPerKwh} kg CO2/kWh — ${report.baseline.source}`);
    h('4. Methodology & formulas');
    for (const [k, v] of Object.entries(report.methodology)) doc.text(`${k}: ${v}`, { paragraphGap: 2 });
    h('5. Tilt history');
    if (!report.tiltHistory.length) doc.text('No tilt changes recorded in the platform.');
    report.tiltHistory.slice(-15).forEach((l) => doc.text(`${new Date(l.at).toISOString().slice(0, 16)} · ${l.tiltDeg}° (optimal ${l.optimalDeg ?? '—'}°) via ${l.source}`));
    h('6. Daily ledger');
    const cols = ['date', 'source', 'energy_kwh', 'irradiance_kwh_m2', 'tmax_c', 'panel_temp_c', 'tilt_deg', 'co2_avoided_kg', 'water_saved_l'];
    const widths = [58, 52, 52, 60, 40, 55, 38, 64, 58];
    const row = (vals, bold) => {
        let x = 40; const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
        vals.forEach((v, i) => { doc.text(String(v ?? ''), x, y, { width: widths[i] }); x += widths[i]; });
        doc.moveDown(0.2);
        if (doc.y > 780) doc.addPage();
    };
    row(cols, true);
    report.daily.forEach((d) => row(cols.map((c) => d[c])));
    doc.x = 40;
    h('7. Integrity');
    doc.text(`Dataset SHA-256: ${report.datasetSha256}`);
    doc.text('Hourly generation log is provided as a separate CSV (/api/carbon/mrv?format=hourly-csv).');
    doc.fillColor('#555').text('Note: modelled days are estimates from satellite-derived irradiance; registry issuance (Verra / Gold Standard / India CCTS) requires third-party validation and metered data.', { paragraphGap: 4 });
    doc.end();
}

function round(v, d = 2) { return v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d; }

module.exports = { build, hourly, toCsv, toPdf, GRID_EF };
