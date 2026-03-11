/**
 * DiseaseDetector — Live Roboflow Integration
 * 
 * NOTE: The Scan Hub does NOT use this file directly.
 * The main scan flow is:  scanRoutes.js → scanController.js → callRoboflow()
 * 
 * This file is kept as a standalone utility if other parts of the app
 * need disease detection (e.g., batch processing, CLI tools, etc.)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load KB for treatment mapping
const visionKB = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'vision_knowledge_base.json'), 'utf8')
);
const CROP_DB = visionKB.crop_disease_db || {};

class DiseaseDetector {
    constructor() {
        this.apiKey = process.env.ROBOFLOW_API_KEY || 'mCLodEga0a4myt2CI8SJ';
        this.model1 = 'plantdoc-rcmou-konc0/1';     // PlantDoc Detection
        this.model2 = 'plant-disease-nzhj9-qqsvb/1'; // Plant Disease Segmentation
        this.baseUrl = 'https://serverless.roboflow.com';
    }

    /**
     * Detect crop disease from an image using Roboflow API
     * @param {string} imageInput - Either a file path OR a base64 string
     * @param {string} cropType - Optional crop hint (auto-detected if omitted)
     * @returns {object} Detection result with disease, confidence, treatment
     */
    async detectCropDisease(imageInput, cropType = null) {
        try {
            // 1. Prepare base64 image
            let base64Image;
            if (fs.existsSync(imageInput)) {
                // It's a file path — read and convert to base64
                const imageBuffer = fs.readFileSync(imageInput);
                base64Image = imageBuffer.toString('base64');
            } else {
                // It's already base64 — clean it
                base64Image = imageInput.replace(/^data:image\/\w+;base64,/, '');
            }

            // 2. Call BOTH Roboflow models in parallel (no hardcoding, no simulation)
            const [r1, r2] = await Promise.allSettled([
                axios({
                    method: 'POST',
                    url: `${this.baseUrl}/${this.model1}`,
                    params: { api_key: this.apiKey, confidence: 40, overlap: 30 },
                    data: base64Image,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 25000,
                }),
                axios({
                    method: 'POST',
                    url: `${this.baseUrl}/${this.model2}`,
                    params: { api_key: this.apiKey, confidence: 40, overlap: 30 },
                    data: base64Image,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 25000,
                }),
            ]);

            // 3. Merge predictions from both models
            let predictions = [];
            if (r1.status === 'fulfilled' && r1.value.data.predictions) {
                predictions.push(...r1.value.data.predictions.map(p => ({ ...p, source: 'PlantDoc' })));
            }
            if (r2.status === 'fulfilled' && r2.value.data.predictions) {
                predictions.push(...r2.value.data.predictions.map(p => ({ ...p, source: 'PlantDisease' })));
            }

            // 4. Filter out generic detections (just "leaf", "plant")
            predictions = predictions.filter(p => {
                const cls = p.class.toLowerCase();
                return cls !== 'leaf' && cls !== 'plant' && cls !== 'healthy';
            });

            // 5. No predictions → Healthy or Inconclusive
            if (predictions.length === 0) {
                return {
                    type: 'crop',
                    crop: cropType || 'Unknown',
                    disease: 'Healthy',
                    confidence: 0,
                    severity: 'None',
                    treatment: ['No disease detected. Try a clearer close-up photo if symptoms are visible.'],
                    processingTime: `${r1.value?.data?.time || 0}ms`,
                };
            }

            // 6. Pick the highest-confidence prediction
            const best = predictions.reduce((a, b) => a.confidence > b.confidence ? a : b);
            const confPct = Math.round(best.confidence * 100);

            // 7. Auto-detect crop from class name (e.g., "Tomato leaf bacterial spot" → "Tomato")
            const detectedCrop = this._detectCropFromClass(best.class) || cropType || 'Unknown';

            // 8. Map to KB for treatment info
            const kbMatch = this._mapToKB(best.class);

            if (kbMatch) {
                return {
                    type: 'crop',
                    crop: detectedCrop,
                    disease: kbMatch.disease,
                    confidence: confPct,
                    severity: kbMatch.severity_levels?.[Math.min(Math.floor(confPct / 25), (kbMatch.severity_levels.length - 1))] || 'Moderate',
                    treatment: kbMatch.treatment || [],
                    symptoms: kbMatch.symptoms || '',
                    source: best.source,
                    rawClass: best.class,
                };
            }

            // No KB match — return raw Roboflow result
            return {
                type: 'crop',
                crop: detectedCrop,
                disease: best.class.replace(/_/g, ' '),
                confidence: confPct,
                severity: confPct > 80 ? 'Severe' : confPct > 50 ? 'Moderate' : 'Mild',
                treatment: ['Consult your nearest agriculture expert with this scan result.'],
                source: best.source,
                rawClass: best.class,
            };

        } catch (error) {
            console.error('DiseaseDetector Error:', error.message);
            return { error: 'AI Service Unavailable', message: error.message };
        }
    }

    /** Auto-detect crop name from Roboflow class string */
    _detectCropFromClass(className) {
        const raw = className.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
        const knownCrops = Object.keys(CROP_DB).map(c => c.toLowerCase());
        for (const crop of knownCrops) {
            if (raw.startsWith(crop) || raw.includes(crop + ' ')) {
                return crop.charAt(0).toUpperCase() + crop.slice(1);
            }
        }
        return null;
    }

    /** Map Roboflow class to Knowledge Base entry (searches ALL crops) */
    _mapToKB(className) {
        const raw = className.toLowerCase().trim();
        for (const crop of Object.keys(CROP_DB)) {
            const diseases = CROP_DB[crop];
            if (!diseases) continue;
            const match = diseases.find(d =>
                (d.plantdoc_class && d.plantdoc_class.toLowerCase() === raw) ||
                d.disease.toLowerCase() === raw.replace(/_/g, ' ') ||
                raw.replace(/_/g, ' ').includes(d.disease.toLowerCase())
            );
            if (match) return match;
        }
        return null;
    }
}

module.exports = new DiseaseDetector();
