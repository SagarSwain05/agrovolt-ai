'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Agrivoltaic physics shared by the energy ledger, the virtual
// sensor node and the assistant. All inputs are real (Open-Meteo / NASA POWER
// irradiance + temperature, farm configuration); constants are cited inline.
// ═══════════════════════════════════════════════════════════════════════════
const ipcc = require('../data/ipcc_factors.json');

const GRID_EF_KG_PER_KWH = ipcc.grid_emission_factor_kg_per_kwh || 0.82;
const PERFORMANCE_RATIO = 0.8;          // inverter + wiring + soiling losses (typical PR 0.75–0.85)
const TEMP_COEFF_PER_C = 0.004;         // mono-PERC Pmax coefficient ≈ −0.4 %/°C
const NOCT_RISE_C = 25;                 // (NOCT 45 °C − 20 °C) at 800 W/m²
const GROUND_AREA_M2_PER_KW = 6.5;      // shaded footprint per kWp incl. row spacing
const SHADE_EVAP_REDUCTION = 0.3;       // 20–30 % lower soil evaporation under panels
const CREDIT_PRICE_INR = 1500;          // voluntary market ₹/tCO2e (see carbon_intelligence.json)

// Transpiration cooling coefficient (°C of panel cooling per unit coverage) by understory crop
const COOLING_COEFF = {
    general: 0.08, turmeric: 0.10, ginger: 0.09, spinach: 0.07, rice: 0.12, tomato: 0.06,
    lettuce: 0.07, chili: 0.065, potato: 0.07, onion: 0.05, groundnut: 0.06, millet: 0.05,
};

function coolingCoeff(crop) {
    return COOLING_COEFF[String(crop || 'general').toLowerCase()] ?? COOLING_COEFF.general;
}

/** Panel cell temperature (°C) from ambient + irradiance, minus crop transpiration cooling. */
function panelTemperature(ambientC, irradianceWm2, crop, shadeCoveragePct, soilMoisturePct = 25) {
    const rise = (irradianceWm2 / 800) * NOCT_RISE_C;
    // Transpiration scales with available soil water: dry soil → stomata close → less cooling.
    const waterFactor = Math.max(0.3, Math.min(1.2, soilMoisturePct / 25));
    const cooling = ambientC * coolingCoeff(crop) * (shadeCoveragePct / 100) * waterFactor * (irradianceWm2 > 50 ? 1 : 0);
    return {
        uncooled: ambientC + rise,
        cooled: ambientC + rise - cooling,
        coolingDeltaC: cooling,
    };
}

/** Instantaneous AC power (W) for the array. */
function instantPowerW({ capacityKW, irradianceWm2, panelTempC, tiltFactor = 1 }) {
    const tempDerate = 1 - TEMP_COEFF_PER_C * Math.max(0, panelTempC - 25);
    return Math.max(0, capacityKW * 1000 * (irradianceWm2 / 1000) * PERFORMANCE_RATIO * tempDerate * tiltFactor);
}

/** Fraction of optimal yield given tilt mismatch (≈0.8 % per degree, matches solarPosition.js). */
function tiltFactor(currentTilt, optimalTilt) {
    return Math.max(0.7, 1 - Math.abs((currentTilt ?? optimalTilt) - optimalTilt) * 0.008);
}

/**
 * Daily energy balance.
 * E = P_rated × PSH × PR × η_temp × η_tilt, with bio-cooling credited separately.
 */
function dailyEnergy({ capacityKW, peakSunHours, tempMaxC, crop, shadeCoveragePct, tiltFactor: tf = 1, et0Mm = 4, soilMoisturePct = 25 }) {
    // Mean daytime cell temperature: use ~85 % of Tmax and a mid-day irradiance of 650 W/m²
    const ambientDay = tempMaxC * 0.85 + 2;
    const t = panelTemperature(ambientDay, 650, crop, shadeCoveragePct, soilMoisturePct);
    const etaUncooled = 1 - TEMP_COEFF_PER_C * Math.max(0, t.uncooled - 25);
    const etaCooled = 1 - TEMP_COEFF_PER_C * Math.max(0, t.cooled - 25);
    const base = capacityKW * peakSunHours * PERFORMANCE_RATIO * tf;
    const energyKwh = base * etaCooled;
    const bioCoolingGainKwh = base * (etaCooled - etaUncooled);

    const shadedAreaM2 = capacityKW * GROUND_AREA_M2_PER_KW;
    const waterSavedLiters = et0Mm * shadedAreaM2 * SHADE_EVAP_REDUCTION; // 1 mm on 1 m² = 1 L
    const co2AvoidedKg = energyKwh * GRID_EF_KG_PER_KWH;

    return {
        energyKwh,
        bioCoolingDeltaC: t.coolingDeltaC,
        bioCoolingGainKwh,
        efficiencyPct: Math.round(PERFORMANCE_RATIO * etaCooled * tf * 1000) / 10,
        panelTempC: t.cooled,
        waterSavedLiters,
        co2AvoidedKg,
    };
}

/**
 * Photosynthetically active radiation reaching the understory crop (µmol/m²/s).
 * PAR_crop = I_direct × (1 − shading) + I_diffuse, converted with 0.45 PAR fraction × 4.57 µmol/J.
 */
function cropPAR(directWm2, diffuseWm2, shadeCoveragePct) {
    const wm2 = directWm2 * (1 - shadeCoveragePct / 100) + diffuseWm2;
    return Math.round(wm2 * 0.45 * 4.57);
}

module.exports = {
    GRID_EF_KG_PER_KWH, PERFORMANCE_RATIO, CREDIT_PRICE_INR, GROUND_AREA_M2_PER_KW,
    coolingCoeff, panelTemperature, instantPowerW, tiltFactor, dailyEnergy, cropPAR,
};
