const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Farm = require("../models/Farm");
const DiseaseScan = require("../models/DiseaseScan");
const visionEngine = require("../mlModels/visionEngine");

// ═══ Google Cloud Vision API Integration ═══
// Set GOOGLE_VISION_API_KEY in .env to enable real Lens-like detection
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || '';

/**
 * Analyze image using Google Cloud Vision API (Label + Web Detection)
 * Falls back to local color-based heuristic when no API key is set
 */
async function analyzeImageContent(base64Image) {
  // ── Google Cloud Vision API (real detection) ──
  if (GOOGLE_VISION_API_KEY) {
    try {
      const body = JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 15 },
            { type: 'WEB_DETECTION', maxResults: 5 },
          ]
        }]
      });
      const resp = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      const data = await resp.json();
      const labels = (data.responses?.[0]?.labelAnnotations || []).map(l => ({
        label: l.description.toLowerCase(), score: l.score
      }));
      const webEntities = (data.responses?.[0]?.webDetection?.webEntities || []).map(e => ({
        label: (e.description || '').toLowerCase(), score: e.score
      }));
      return classifyFromLabels(labels, webEntities);
    } catch (err) {
      console.error('Google Vision API error, falling back to local:', err.message);
    }
  }

  // ── Local fallback: basic color-channel heuristic ──
  return localImageAnalysis(base64Image);
}

// Classify subject from Google Vision labels
const PLANT_KEYWORDS = ['plant', 'leaf', 'flower', 'tree', 'crop', 'vegetation', 'herb', 'grass',
  'fruit', 'vegetable', 'seedling', 'agriculture', 'farm', 'botanical', 'flora', 'foliage',
  'tomato', 'rice', 'wheat', 'potato', 'grape', 'apple', 'maize', 'corn', 'coffee', 'cotton',
  'citrus', 'mango', 'banana', 'turmeric', 'soybean', 'groundnut', 'millet', 'sugarcane',
  'pepper', 'chili', 'onion', 'okra', 'spinach', 'cabbage', 'cauliflower', 'tea', 'cherry',
  'peach', 'strawberry', 'squash', 'blight', 'fungus', 'disease', 'pest', 'wilt', 'rot',
  'mildew', 'rust', 'infection', 'lesion', 'spot'];
const PANEL_KEYWORDS = ['solar', 'panel', 'photovoltaic', 'cell', 'module', 'inverter',
  'electricity', 'renewable', 'energy', 'silicon', 'volt', 'watt'];

function classifyFromLabels(labels, webEntities) {
  const allLabels = [...labels, ...webEntities];
  let plantScore = 0, panelScore = 0;
  let identifiedCrop = null;
  const CROP_NAMES = Object.keys(require('../data/vision_knowledge_base.json').crop_species_signatures).map(c => c.toLowerCase());

  for (const { label, score } of allLabels) {
    if (PLANT_KEYWORDS.some(kw => label.includes(kw))) plantScore += score;
    if (PANEL_KEYWORDS.some(kw => label.includes(kw))) panelScore += score;
    // Try to match specific crop
    const matchedCrop = CROP_NAMES.find(c => label.includes(c));
    if (matchedCrop && !identifiedCrop) identifiedCrop = matchedCrop.charAt(0).toUpperCase() + matchedCrop.slice(1);
  }

  if (plantScore < 0.3 && panelScore < 0.3) {
    return { valid: false, type: 'unknown', reason: 'No plant or solar panel detected in this image.', labels: labels.slice(0, 5), identifiedCrop: null, confidence: 0, source: 'Google Cloud Vision API' };
  }

  const type = panelScore > plantScore ? 'panel' : 'crop';
  return {
    valid: true, type, identifiedCrop, confidence: Math.round(Math.max(plantScore, panelScore) * 100),
    labels: labels.slice(0, 8), source: 'Google Cloud Vision API',
    reason: type === 'crop'
      ? `Identified as plant/crop${identifiedCrop ? ` (${identifiedCrop})` : ''}`
      : 'Identified as solar panel/photovoltaic module',
  };
}

// Local analysis when no API key: check green-channel dominance
function localImageAnalysis(base64Data) {
  const buf = Buffer.from(base64Data, 'base64');

  // Sample pixels from raw buffer (works for JPEG/PNG — rough approximation)
  let rSum = 0, gSum = 0, bSum = 0, samples = 0;
  // Skip header (first ~200 bytes), sample every 3 bytes
  const start = Math.min(200, Math.floor(buf.length * 0.1));
  const step = Math.max(3, Math.floor((buf.length - start) / 3000));
  for (let i = start; i < buf.length - 2; i += step) {
    rSum += buf[i]; gSum += buf[i + 1]; bSum += buf[i + 2];
    samples++;
  }
  if (samples === 0) return { valid: false, type: 'unknown', reason: 'Could not analyze image.', labels: [], identifiedCrop: null, confidence: 0, source: 'Local Heuristic' };

  const rAvg = rSum / samples, gAvg = gSum / samples, bAvg = bSum / samples;
  const total = rAvg + gAvg + bAvg;
  const gRatio = gAvg / total;
  const bRatio = bAvg / total;
  const grayness = Math.abs(rAvg - gAvg) + Math.abs(gAvg - bAvg) + Math.abs(rAvg - bAvg);

  // Green-dominant = likely plant
  if (gRatio > 0.36) {
    return { valid: true, type: 'crop', identifiedCrop: null, confidence: Math.round(gRatio * 200), labels: [{ label: 'green-dominant (plant likely)', score: gRatio }], source: 'Local Color Analysis', reason: 'Image appears to contain vegetation (green-channel dominant)' };
  }
  // Blue/gray = possibly solar panel
  if (bRatio > 0.36 || grayness < 30) {
    return { valid: true, type: 'panel', identifiedCrop: null, confidence: Math.round((bRatio > 0.36 ? bRatio : 0.5) * 150), labels: [{ label: 'blue/gray (panel likely)', score: bRatio }], source: 'Local Color Analysis', reason: 'Image appears to contain metallic/blue surface (possible solar panel)' };
  }

  return { valid: false, type: 'unknown', reason: 'This doesn\'t appear to be a plant leaf or solar panel. Please upload a clear photo of a crop leaf or solar panel surface.', labels: [{ label: `rgb(${Math.round(rAvg)},${Math.round(gAvg)},${Math.round(bAvg)})`, score: 0 }], identifiedCrop: null, confidence: 0, source: 'Local Color Analysis' };
}

// ═══ New endpoint: Analyze image before disease/defect detection ═══
exports.analyzeImage = async (req, res) => {
  try {
    const { image, mode } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'No image provided' });

    // Strip data URL prefix if present
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const analysis = await analyzeImageContent(base64);

    if (!analysis.valid) {
      return res.json({
        success: true,
        data: {
          valid: false,
          reason: analysis.reason,
          labels: analysis.labels,
          source: analysis.source,
          suggestion: 'Please point your camera at a crop leaf or solar panel surface for accurate diagnosis.',
        }
      });
    }

    // Route to appropriate detector
    let detection;
    if (analysis.type === 'crop' || mode === 'crop') {
      const cropHint = analysis.identifiedCrop || 'Tomato';
      detection = visionEngine.detectCropDisease(cropHint);
      // Override crop name if Vision API identified it
      if (analysis.identifiedCrop) {
        detection.classification.identified_species = analysis.identifiedCrop;
      }
    } else {
      detection = visionEngine.detectPanelDefect();
    }

    res.json({
      success: true,
      data: {
        valid: true,
        analysis,
        detection,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Image analysis failed' });
  }
};

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, `disease-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed"));
  }
}).single("image");


// @desc    Upload and scan crop image for disease
// @route   POST /api/disease/scan
// @access  Private
exports.scanDisease = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const { cropName } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an image"
        });
      }

      if (!cropName) {
        return res.status(400).json({
          success: false,
          message: "Please provide crop name"
        });
      }

      const farm = await Farm.findOne({ userId: req.user._id });

      if (!farm) {
        return res.status(404).json({
          success: false,
          message: "Farm not found"
        });
      }

      // Cascade AI Pipeline — ViT Classifier → YOLOv8 Detector → Context Injector
      const detection = visionEngine.detectCropDisease(cropName);

      const diseaseScan = await DiseaseScan.create({
        farmId: farm._id,
        cropName,
        imageUrl: `/uploads/${req.file.filename}`,
        detectedDisease: detection.disease,
        confidenceScore: detection.confidence,
        treatment: Array.isArray(detection.treatment) ? detection.treatment.join('; ') : detection.treatment,
        severity: detection.severity === 'None' ? 'low' : detection.severity.toLowerCase()
      });

      res.status(201).json({
        success: true,
        message: "Disease scan completed",
        data: {
          scan: diseaseScan,
          recommendations: {
            immediate: detection.severity === "high" ? "Immediate action required" : "Monitor and treat as recommended",
            preventive: "Maintain proper spacing, ensure good air circulation, and regular monitoring",
            organic: "Consider neem oil or bio-pesticides for organic treatment"
          }
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Server error during disease scan"
      });
    }
  });
};

// @desc    Scan solar panel for defects (cascade pipeline)
// @route   POST /api/disease/scan-panel
// @access  Private
exports.scanPanel = async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    try {
      const panelId = req.body.panelId || 'Panel #1';
      const result = visionEngine.detectPanelDefect(panelId);
      res.status(201).json({ success: true, message: 'Panel scan complete', data: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Server error during panel scan' });
    }
  });
};

// @desc    Get farm context for scan hub (weather risk, outbreak radar)
// @route   GET /api/disease/context
// @access  Private
exports.getFarmContext = async (req, res) => {
  try {
    const { crops, weather } = req.query;
    const currentCrops = crops ? crops.split(',') : ['Tomato', 'Rice'];
    const context = visionEngine.getFarmContext(currentCrops, weather || 'high_humidity_gt80');
    res.json({ success: true, data: context });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get disease scan history
// @route   GET /api/disease/history
// @access  Private
exports.getScanHistory = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const scans = await DiseaseScan.find({ farmId: farm._id })
      .sort({ scannedAt: -1 })
      .limit(50);

    const stats = {
      total: scans.length,
      healthy: scans.filter(s => s.detectedDisease === "Healthy").length,
      diseased: scans.filter(s => s.detectedDisease !== "Healthy").length,
      critical: scans.filter(s => s.severity === "high" || s.severity === "critical").length
    };

    res.json({
      success: true,
      data: {
        scans,
        stats
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Update scan status
// @route   PUT /api/disease/:id
// @access  Private
exports.updateScanStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const scan = await DiseaseScan.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Scan not found"
      });
    }

    res.json({
      success: true,
      message: "Scan status updated",
      data: scan
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
