const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const { optionalAuth } = require('../middleware/authMiddleware');
const Farm = require('../models/Farm');
const DiseaseScan = require('../models/DiseaseScan');

function severityLevel(s) {
    const v = String(s || '').toLowerCase();
    if (/critical/.test(v)) return 'critical';
    if (/severe|high/.test(v)) return 'high';
    if (/moder|medium/.test(v)) return 'medium';
    return 'low';
}

// Signed-in users get every crop scan saved to their farm history (feeds the
// dashboard follow-ups, the assistant and the district outbreak radar).
function persistCropScan(req, res, next) {
    if (!req.user) return next();
    const send = res.json.bind(res);
    res.json = (body) => {
        const d = body?.success && body.data;
        if (!d || !d.disease || d.disease === 'API Error') return send(body);
        (async () => {
            try {
                const farm = await Farm.findOne({ userId: req.user._id }).select('_id');
                if (!farm) return;
                const doc = await DiseaseScan.create({
                    farmId: farm._id,
                    cropName: d.crop || 'Unknown',
                    imageUrl: 'not-stored',
                    detectedDisease: d.disease,
                    confidenceScore: Math.max(0, Math.min(100, Number(d.confidence) || 0)),
                    treatment: Array.isArray(d.treatment) ? d.treatment.join(' | ') : String(d.treatment || ''),
                    severity: /healthy/i.test(d.disease) ? 'low' : severityLevel(d.severity),
                    status: /healthy/i.test(d.disease) ? 'resolved' : 'pending',
                });
                body.data.scanId = doc._id;
                if (doc.severity !== 'low' && !/healthy/i.test(doc.detectedDisease)) {
                    require('../services/webhooks').emitForFarm(farm._id, 'disease.detected', { disease: doc.detectedDisease, crop: doc.cropName, confidence: doc.confidenceScore, severity: doc.severity, at: doc.scannedAt });
                }
            } catch (e) {
                console.error('[scan] persist failed:', e.message);
            }
        })().finally(() => send(body));
        return res;
    };
    next();
}

router.post('/crop', optionalAuth, persistCropScan, scanController.scanCropDisease);
router.post('/panel', scanController.scanPanelDefect);
router.post('/growth', scanController.scanGrowthStage);

module.exports = router;
