/**
 * AgroVolt AI — NREL Solar Position Algorithm
 * 
 * Implements simplified solar position calculations based on
 * NREL SPA (Solar Position Algorithm) formulas.
 * 
 * Computes: solar altitude, azimuth, optimal tilt angle,
 * hour-by-hour sun path, and bio-cooling efficiency gain.
 */

class SolarPositionCalculator {
    /**
     * Get optimal tilt angle for a given location and date
     */
    getOptimalTilt(lat, lon, date = new Date()) {
        const dayOfYear = this._dayOfYear(date);
        const declination = this._solarDeclination(dayOfYear);

        // Optimal tilt = latitude - declination (simplified)
        // Summer: lower tilt, Winter: higher tilt
        const optimalTilt = Math.round(Math.abs(lat - declination));

        // Clamp between 10° and 60°
        return Math.max(10, Math.min(60, optimalTilt));
    }

    /**
     * Get hour-by-hour sun positions for a given day
     */
    getSunPath(lat, lon, date = new Date()) {
        const dayOfYear = this._dayOfYear(date);
        const declination = this._solarDeclination(dayOfYear);
        const equationOfTime = this._equationOfTime(dayOfYear);

        const hourly = [];
        for (let hour = 5; hour <= 19; hour++) {
            const solarTime = hour + (4 * (lon - 82.5) + equationOfTime) / 60;
            const hourAngle = (solarTime - 12) * 15;

            const latRad = lat * Math.PI / 180;
            const decRad = declination * Math.PI / 180;
            const haRad = hourAngle * Math.PI / 180;

            // Solar altitude
            const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
                Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
            const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;

            // Solar azimuth
            const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
                (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
            let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
            if (hourAngle > 0) azimuth = 360 - azimuth;

            if (altitude > 0) {
                hourly.push({
                    hour,
                    altitude: Math.round(altitude * 10) / 10,
                    azimuth: Math.round(azimuth * 10) / 10,
                    optimalTilt: this._hourlyOptimalTilt(altitude, lat),
                    irradiance: this._estimateIrradiance(altitude),
                });
            }
        }

        return hourly;
    }

    /**
     * Calculate bio-cooling efficiency gain from crop transpiration
     */
    bioCoolingEffect(ambientTemp, cropType = 'general', coveragePct = 40) {
        // Crop transpiration cooling coefficients
        const coolingCoeffs = {
            'general': 0.08,
            'turmeric': 0.10,
            'ginger': 0.09,
            'spinach': 0.07,
            'rice': 0.12,
            'tomato': 0.06,
        };

        const coeff = coolingCoeffs[cropType.toLowerCase()] || coolingCoeffs.general;
        const coolingDegrees = ambientTemp * coeff * (coveragePct / 100);

        // Panel efficiency gain: ~0.5% per °C reduction (silicon panels)
        const efficiencyGain = coolingDegrees * 0.5;

        return {
            temperatureReduction: Math.round(coolingDegrees * 10) / 10,
            efficiencyGain: Math.round(efficiencyGain * 10) / 10,
            adjustedPanelTemp: Math.round((ambientTemp - coolingDegrees) * 10) / 10,
            notes: `${cropType} transpiration reduces panel temperature by ${coolingDegrees.toFixed(1)}°C, gaining ${efficiencyGain.toFixed(1)}% efficiency`,
        };
    }

    /**
     * Full analysis for a location
     */
    analyze(lat, lon, currentTilt, panelCapacityKw = 5, cropType = 'general') {
        const now = new Date();
        const optimalTilt = this.getOptimalTilt(lat, lon, now);
        const sunPath = this.getSunPath(lat, lon, now);
        const bioCooling = this.bioCoolingEffect(35, cropType);

        // Energy estimation
        const peakSunHours = sunPath.filter(h => h.altitude > 15).length;
        const tiltEfficiency = 1 - Math.abs(currentTilt - optimalTilt) * 0.008;
        const estimatedDailyKwh = panelCapacityKw * peakSunHours * 0.85 * tiltEfficiency;
        const optimizedDailyKwh = panelCapacityKw * peakSunHours * 0.85;
        const gainKwh = optimizedDailyKwh - estimatedDailyKwh;

        return {
            currentTilt,
            optimalTilt,
            tiltDifference: optimalTilt - currentTilt,
            efficiencyGain: `+${Math.round((gainKwh / estimatedDailyKwh) * 100)}%`,
            sunPath,
            bioCooling,
            energyEstimate: {
                currentDaily: Math.round(estimatedDailyKwh * 10) / 10,
                optimizedDaily: Math.round(optimizedDailyKwh * 10) / 10,
                gainKwh: Math.round(gainKwh * 10) / 10,
                peakSunHours,
            },
            sunrise: sunPath[0]?.hour || 6,
            sunset: sunPath[sunPath.length - 1]?.hour || 18,
            date: now.toISOString().split('T')[0],
        };
    }

    // --- Helper Methods ---

    _dayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        return Math.floor((date - start) / (1000 * 60 * 60 * 24));
    }

    _solarDeclination(dayOfYear) {
        return 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    }

    _equationOfTime(dayOfYear) {
        const b = (360 / 365) * (dayOfYear - 81) * Math.PI / 180;
        return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    }

    _hourlyOptimalTilt(altitude, lat) {
        // Optimal tilt ≈ 90° - altitude for max perpendicular incidence
        return Math.max(10, Math.min(60, Math.round(90 - altitude)));
    }

    _estimateIrradiance(altitude) {
        // Simplified irradiance based on solar altitude (W/m²)
        if (altitude <= 0) return 0;
        const airmass = 1 / Math.sin(altitude * Math.PI / 180);
        return Math.round(1366 * 0.7 ** (airmass ** 0.678));
    }
}

module.exports = new SolarPositionCalculator();
