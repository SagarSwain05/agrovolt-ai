/**
 * AgroVolt AI — ESG Certificate Generator
 * 
 * Generates verifiable ESG (Environmental, Social, Governance) certificates
 * with IPCC-verified carbon savings calculations.
 */

const crypto = require('crypto');
const ipccFactors = require('../data/ipcc_factors.json');

class ESGCertificateGenerator {
    /**
     * Calculate carbon savings for a given period
     */
    calculateSavings(data) {
        const { solarKwhGenerated = 0, waterSavedLiters = 0, bioCoolingDegrees = 0, days = 30, cropType = 'general' } = data;

        const factor = ipccFactors.factors;

        const solarSavings = solarKwhGenerated * factor.solar_generation.factor_kg_co2;
        const waterSavings = (waterSavedLiters / 1000) * factor.water_savings.factor_kg_co2;
        const bioCoolingSavings = bioCoolingDegrees * factor.bio_cooling.factor_kg_co2_per_degree * days;

        const totalKgCo2 = solarSavings + waterSavings + bioCoolingSavings;
        const totalTonnesCo2 = totalKgCo2 / 1000;

        const creditValue = totalTonnesCo2 * ipccFactors.carbon_credit_pricing.voluntary_market_india.avg_inr_per_credit;

        return {
            breakdown: {
                solarGeneration: { kgCo2: Math.round(solarSavings * 100) / 100, factor: factor.solar_generation.factor_kg_co2, input: `${solarKwhGenerated} kWh` },
                waterSavings: { kgCo2: Math.round(waterSavings * 100) / 100, factor: factor.water_savings.factor_kg_co2, input: `${waterSavedLiters} L` },
                bioCooling: { kgCo2: Math.round(bioCoolingSavings * 100) / 100, factor: factor.bio_cooling.factor_kg_co2_per_degree, input: `${bioCoolingDegrees}°C × ${days} days` },
            },
            totalKgCo2: Math.round(totalKgCo2 * 100) / 100,
            totalTonnesCo2: Math.round(totalTonnesCo2 * 1000) / 1000,
            creditValue: Math.round(creditValue),
            methodology: ipccFactors.methodology,
            source: ipccFactors.source,
        };
    }

    /**
     * Generate an ESG Certificate
     */
    generateCertificate(farmerData, savingsData) {
        const savings = this.calculateSavings(savingsData);
        const certId = `AV-ESG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const verificationHash = crypto
            .createHash('sha256')
            .update(`${certId}:${savings.totalKgCo2}:${farmerData.name}:${new Date().toISOString()}`)
            .digest('hex')
            .substring(0, 16)
            .toUpperCase();

        return {
            certificate: {
                id: certId,
                type: 'ESG Carbon Offset Certificate',
                issuedTo: farmerData.name,
                district: farmerData.district || 'Khordha',
                state: farmerData.state || 'Odisha',
                issuedDate: new Date().toISOString().split('T')[0],
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                verificationHash,
                verificationUrl: `https://agrovolt.in/verify/${certId}`,
            },
            carbonSavings: savings,
            environmentalImpact: {
                treesEquivalent: Math.round(savings.totalKgCo2 / 21),
                carKmOffset: Math.round(savings.totalKgCo2 / 0.21 * 1.6),
                householdDaysOffset: Math.round(savings.totalKgCo2 / 7.5),
            },
            verification: {
                methodology: savings.methodology,
                source: savings.source,
                standards: ipccFactors.verification_standards,
            },
        };
    }
}

module.exports = new ESGCertificateGenerator();
