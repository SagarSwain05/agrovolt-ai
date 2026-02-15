const multer = require("multer");
const path = require("path");
const Farm = require("../models/Farm");
const DiseaseScan = require("../models/DiseaseScan");

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

// Mock AI disease detection (replace with actual TensorFlow model later)
const detectDisease = (cropName) => {
  const diseases = {
    "Tomato": [
      { name: "Early Blight", confidence: 87, treatment: "Apply copper-based fungicide. Remove affected leaves.", severity: "medium" },
      { name: "Late Blight", confidence: 82, treatment: "Use mancozeb or chlorothalonil. Improve air circulation.", severity: "high" },
      { name: "Leaf Curl", confidence: 78, treatment: "Control whiteflies. Use neem oil spray.", severity: "medium" }
    ],
    "Rice": [
      { name: "Blast", confidence: 85, treatment: "Apply tricyclazole fungicide. Maintain proper water level.", severity: "high" },
      { name: "Bacterial Leaf Blight", confidence: 80, treatment: "Use copper oxychloride. Remove infected plants.", severity: "high" },
      { name: "Sheath Blight", confidence: 75, treatment: "Apply validamycin. Reduce nitrogen fertilizer.", severity: "medium" }
    ],
    "Wheat": [
      { name: "Rust", confidence: 88, treatment: "Apply propiconazole fungicide. Use resistant varieties.", severity: "high" },
      { name: "Blight", confidence: 83, treatment: "Use mancozeb. Ensure proper drainage.", severity: "medium" },
      { name: "Smut", confidence: 79, treatment: "Seed treatment with carboxin. Crop rotation.", severity: "medium" }
    ]
  };

  const cropDiseases = diseases[cropName] || diseases["Tomato"];
  const randomDisease = cropDiseases[Math.floor(Math.random() * cropDiseases.length)];
  
  // Simulate healthy detection 30% of the time
  if (Math.random() < 0.3) {
    return {
      name: "Healthy",
      confidence: 92,
      treatment: "No treatment needed. Continue regular care.",
      severity: "low"
    };
  }
  
  return randomDisease;
};

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

      // Mock AI detection (replace with actual model)
      const detection = detectDisease(cropName);

      const diseaseScan = await DiseaseScan.create({
        farmId: farm._id,
        cropName,
        imageUrl: `/uploads/${req.file.filename}`,
        detectedDisease: detection.name,
        confidenceScore: detection.confidence,
        treatment: detection.treatment,
        severity: detection.severity
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
