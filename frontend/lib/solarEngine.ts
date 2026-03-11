/**
 * Solar Physics Engine — zero-latency, client-side solar simulation
 * Uses suncalc for astronomically accurate sun positioning
 */

// @ts-ignore — suncalc doesn't ship types
import SunCalc from 'suncalc';

// ─── Sun Position ───────────────────────────────────────────

export interface SunPosition {
    altitude: number;       // radians above horizon
    azimuth: number;        // radians from south
    altitudeDeg: number;    // degrees above horizon
    azimuthDeg: number;     // degrees from north (compass)
    isAboveHorizon: boolean;
}

export function getSunPosition(date: Date, lat: number, lon: number): SunPosition {
    const pos = SunCalc.getPosition(date, lat, lon);
    const altDeg = pos.altitude * (180 / Math.PI);
    // suncalc azimuth: 0=south, PI=north. Convert to compass: 0=north
    const azDeg = ((pos.azimuth * (180 / Math.PI)) + 180) % 360;
    return {
        altitude: pos.altitude,
        azimuth: pos.azimuth,
        altitudeDeg: altDeg,
        azimuthDeg: azDeg,
        isAboveHorizon: altDeg > 0,
    };
}

// ─── Sun Times ──────────────────────────────────────────────

export interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
    goldenHour: Date;
    dawn: Date;
    dusk: Date;
    dayLengthHours: number;
}

export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
    const times = SunCalc.getTimes(date, lat, lon);
    const dayLength = (times.sunset.getTime() - times.sunrise.getTime()) / 3_600_000;
    return {
        sunrise: times.sunrise,
        sunset: times.sunset,
        solarNoon: times.solarNoon,
        goldenHour: times.goldenHour,
        dawn: times.dawn,
        dusk: times.dusk,
        dayLengthHours: Math.round(dayLength * 10) / 10,
    };
}

// ─── Solar Efficiency ──────────────────────────────────────

/**
 * Calculate panel efficiency based on sun angle and weather conditions
 * @param sunAltitudeDeg - sun altitude in degrees (from suncalc)
 * @param cloudCover - 0-100 cloud percentage from weather API
 * @param humidity - 0-100 humidity percentage
 * @returns efficiency percentage 0-100
 */
export function calcSolarEfficiency(
    sunAltitudeDeg: number,
    cloudCover: number,
    humidity: number = 50
): number {
    // No generation when sun is below horizon
    if (sunAltitudeDeg <= 0) return 0;

    // Base efficiency from sun altitude (peaks at 90° which rarely happens)
    // Using sin curve: efficiency increases as sun goes higher
    const sunFactor = Math.sin(sunAltitudeDeg * (Math.PI / 180));
    let efficiency = sunFactor * 100;

    // Cloud cover reduction (0-40% reduction for 0-100% clouds)
    const cloudPenalty = cloudCover * 0.4;
    efficiency -= cloudPenalty;

    // Humidity penalty (slight: 0-5% reduction)
    const humidityPenalty = Math.max(0, (humidity - 50) * 0.1);
    efficiency -= humidityPenalty;

    // Bio-cooling bonus from crops underneath panels (+3-5%)
    const bioCoolingBonus = 3 + sunFactor * 2;
    efficiency += bioCoolingBonus;

    return Math.max(0, Math.min(98, Math.round(efficiency)));
}

// ─── Optimal Tilt Angle ────────────────────────────────────

/**
 * Calculate optimal panel tilt angle for current conditions
 * Based on latitude and time of year
 */
export function calcOptimalTilt(lat: number, dayOfYear: number): number {
    // Simplified: optimal tilt = latitude ± seasonal adjustment
    // Summer (long days): tilt = lat - 15°
    // Winter (short days): tilt = lat + 15°
    // Spring/Autumn: tilt = lat
    const seasonalOffset = 15 * Math.cos((dayOfYear - 172) * (2 * Math.PI / 365));
    const tilt = Math.abs(lat) - seasonalOffset;
    return Math.max(5, Math.min(60, Math.round(tilt)));
}

/**
 * Get current panel tilt and recommendation
 */
export function getTiltRecommendation(currentTilt: number, optimalTilt: number): string {
    const diff = Math.abs(currentTilt - optimalTilt);
    if (diff <= 2) return `Tilt at ${currentTilt}° — optimal position ✓`;
    const direction = currentTilt > optimalTilt ? 'decrease' : 'increase';
    return `Tilt at ${currentTilt}° — ${direction} to ${optimalTilt}° for +${Math.round(diff * 0.3)}% gain`;
}

// ─── Energy Generation ─────────────────────────────────────

/**
 * Estimate cumulative kWh generated today by simulating the sun's
 * hourly journey from sunrise to now (or sunset if past sunset).
 * This means after sunset, it still shows the FULL day's total.
 *
 * @param lat - latitude for suncalc
 * @param lon - longitude for suncalc
 * @param sunrise - sunrise Date
 * @param sunset - sunset Date
 * @param now - current Date
 * @param cloudCover - 0-100 cloud %
 * @param humidity - 0-100 humidity %
 * @param panelCapacityKW - panel capacity in kW (default 2kW for small farm)
 */
export function calcEnergyToday(
    lat: number,
    lon: number,
    sunrise: Date,
    sunset: Date,
    now: Date,
    cloudCover: number = 30,
    humidity: number = 50,
    panelCapacityKW: number = 2
): number {
    if (now < sunrise) return 0;

    // End time is either now or sunset, whichever is earlier
    const endTime = now > sunset ? sunset : now;
    const totalHours = (endTime.getTime() - sunrise.getTime()) / 3_600_000;
    if (totalHours <= 0) return 0;

    // Sample every 30 minutes from sunrise to endTime
    let totalKWh = 0;
    const stepMs = 30 * 60_000; // 30 min steps
    let t = new Date(sunrise.getTime());

    while (t <= endTime) {
        const pos = SunCalc.getPosition(t, lat, lon);
        const altDeg = pos.altitude * (180 / Math.PI);
        if (altDeg > 0) {
            const eff = calcSolarEfficiency(altDeg, cloudCover, humidity);
            // Each step is 0.5 hours
            totalKWh += panelCapacityKW * (eff / 100) * 0.5;
        }
        t = new Date(t.getTime() + stepMs);
    }

    return Math.round(totalKWh * 10) / 10;
}

// ─── Water Savings ─────────────────────────────────────────

/**
 * Calculate water saved by panel shade
 * Panels reduce evapotranspiration by 20-30%
 */
export function calcWaterSaved(hoursSinceSunrise: number, temperature: number): number {
    const baseUsage = 200; // liters per hour baseline
    const evapReduction = 0.25; // 25% savings from shade
    const tempFactor = Math.max(0.8, Math.min(1.3, temperature / 30));
    const saved = hoursSinceSunrise * baseUsage * evapReduction * tempFactor;
    return Math.round(saved);
}

// ─── Day Progress ──────────────────────────────────────────

export function getDayProgress(sunrise: Date, sunset: Date, now: Date): number {
    if (now < sunrise) return 0;
    if (now > sunset) return 100;
    const total = sunset.getTime() - sunrise.getTime();
    const elapsed = now.getTime() - sunrise.getTime();
    return Math.round((elapsed / total) * 100);
}

// ─── Sun Intensity for Visual ──────────────────────────────

/**
 * Returns 0-1 intensity for sun icon brightness/size animations
 */
export function getSunIntensity(sunAltitudeDeg: number): number {
    if (sunAltitudeDeg <= 0) return 0;
    return Math.min(1, sunAltitudeDeg / 60); // max intensity at 60°
}

// ─── Get Day of Year ───────────────────────────────────────

export function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / 86_400_000);
}
