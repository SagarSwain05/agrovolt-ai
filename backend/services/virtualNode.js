'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Virtual sensor node
// Produces the same reading shape a physical ESP32 node would send, computed
// from live Open-Meteo conditions at the farm + the agrivoltaic physics model.
// Used whenever no physical device has reported in the last 15 minutes.
// ═══════════════════════════════════════════════════════════════════════════
const weather = require('./weatherService');
const physics = require('./agrivoltaicPhysics');
const solarPosition = require('../mlModels/solarPosition');

const round = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

async function read(farm) {
    const { latitude: lat, longitude: lon } = farm.location;
    const om = await weather.getOpenMeteo(lat, lon);
    const c = om.current;
    const hourIdx = om.hourly.time.findIndex((t) => t === c.time.slice(0, 13) + ':00');
    const direct = hourIdx >= 0 ? om.hourly.direct_radiation[hourIdx] || 0 : (c.shortwave_radiation || 0) * 0.75;
    const diffuse = hourIdx >= 0 ? om.hourly.diffuse_radiation[hourIdx] || 0 : (c.shortwave_radiation || 0) * 0.25;
    const soilTemp = hourIdx >= 0 ? om.hourly.soil_temperature_0cm[hourIdx] : null;

    const G = c.shortwave_radiation || 0;
    const shade = farm.shadeCoverage ?? 35;
    // Panels cut evaporation, so soil under the array holds more water than open field
    const openSoil = c.soil_moisture_0_to_1cm != null ? c.soil_moisture_0_to_1cm * 100 : 25;
    const soilMoisture = openSoil * (1 + 0.25 * (shade / 100));
    const t = physics.panelTemperature(c.temperature_2m, G, farm.cropUnderPanels, shade, soilMoisture);

    const hasSolar = farm.solarInstalled && farm.solarCapacityKW > 0;
    const tf = physics.tiltFactor(farm.panelTilt, solarPosition.getOptimalTilt(lat, lon));
    const powerW = hasSolar ? physics.instantPowerW({ capacityKW: farm.solarCapacityKW, irradianceWm2: G, panelTempC: t.cooled, tiltFactor: tf }) : 0;

    // Energy so far today from hourly irradiance (same method as the ledger)
    const today = c.time.slice(0, 10);
    const nowH = Number(c.time.slice(11, 13));
    const pshSoFar = om.hourly.time.reduce((s, ts, i) => (ts.startsWith(today) && Number(ts.slice(11, 13)) < nowH ? s + (om.hourly.shortwave_radiation[i] || 0) / 1000 : s), 0);
    const energyToday = hasSolar
        ? physics.dailyEnergy({ capacityKW: farm.solarCapacityKW, peakSunHours: pshSoFar, tempMaxC: om.daily.temperature_2m_max[0], crop: farm.cropUnderPanels, shadeCoveragePct: shade, tiltFactor: tf }).energyKwh
        : 0;

    return {
        source: 'virtual',
        ts: new Date(),
        ambientTempC: round(c.temperature_2m),
        underCanopyTempC: round(c.temperature_2m - (G > 100 ? 1.5 + 3 * (shade / 100) : 0.5)),
        humidityPct: round(c.relative_humidity_2m, 0),
        panelTempC: hasSolar ? round(t.cooled) : null,
        panelTempUncooledC: hasSolar ? round(t.uncooled) : null,
        irradianceWm2: Math.round(G),
        lux: Math.round(G * 116),
        parCrop: physics.cropPAR(direct, diffuse, shade),
        soilMoisturePct: round(soilMoisture),
        soilTempC: round(soilTemp),
        soilN: null, soilP: null, soilK: null, soilPH: null, // need a physical NPK probe
        powerW: Math.round(powerW),
        energyTodayKwh: round(energyToday, 2),
        panelTiltDeg: farm.panelTilt,
        bioCoolingDeltaC: hasSolar ? round(t.coolingDeltaC) : null,
        weatherTime: c.time,
    };
}

module.exports = { read };
