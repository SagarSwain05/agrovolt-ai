const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const CarbonTransaction = require("../models/CarbonTransaction");
const esgGenerator = require("../utils/esgCertificate");
const ledger = require("../services/energyLedger");

// Calculate carbon credits using IPCC-verified emission factors
const calculateCarbonCredits = (energyKWh, waterLiters) => {
  const savings = esgGenerator.calculateSavings({
    solarKwhGenerated: energyKWh,
    waterSavedLiters: waterLiters,
  });

  return {
    credits: savings.totalTonnesCo2,
    co2Reduced: savings.totalKgCo2,
    breakdown: {
      fromSolar: savings.breakdown.solarGeneration.kgCo2,
      fromWater: savings.breakdown.waterSavings.kgCo2,
    },
    methodology: savings.methodology,
  };
};


// @desc    Get carbon wallet data
// @route   GET /api/carbon/wallet
// @access  Private
exports.getCarbonWallet = async (req, res) => {
  try {
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    await ledger.ensureLedger(farm).catch((e) => console.error("ledger:", e.message));

    // Get all carbon transactions
    const transactions = await CarbonTransaction.find({
      farmId: farm._id
    }).sort({ timestamp: -1 });

    const totalCredits = transactions
      .filter(t => t.transactionType === "earned")
      .reduce((sum, t) => sum + t.creditsEarned, 0);

    const withdrawnCredits = transactions
      .filter(t => t.transactionType === "withdrawn")
      .reduce((sum, t) => sum + t.creditsEarned, 0);

    const availableCredits = totalCredits - withdrawnCredits;

    const totalWaterSaved = transactions.reduce((sum, t) => sum + t.waterSavedLiters, 0);
    const totalCO2Reduced = transactions.reduce((sum, t) => sum + t.co2ReducedKg, 0);

    // Current market rate: ₹1500 per carbon credit
    const marketRate = 1500;
    const monetaryValue = availableCredits * marketRate;

    // Environmental impact equivalents
    const treesEquivalent = Math.round(totalCO2Reduced / 21); // 1 tree absorbs ~21 kg CO2/year
    const carMilesOffset = Math.round(totalCO2Reduced / 0.404); // 1 mile = ~0.404 kg CO2

    res.json({
      success: true,
      data: {
        wallet: {
          totalCredits: Math.round(totalCredits * 1000) / 1000,
          withdrawnCredits: Math.round(withdrawnCredits * 1000) / 1000,
          availableCredits: Math.round(availableCredits * 1000) / 1000,
          monetaryValue: Math.round(monetaryValue)
        },
        impact: {
          waterSaved: Math.round(totalWaterSaved),
          co2Reduced: Math.round(totalCO2Reduced * 100) / 100,
          treesEquivalent,
          carMilesOffset
        },
        marketInfo: {
          currentRate: marketRate,
          trend: "stable",
          lastUpdated: new Date()
        },
        transactions: transactions.slice(0, 10), // Last 10 transactions
        insights: (() => {
          const days = new Set(transactions.filter((t) => t.sourceDay).map((t) => t.sourceDay)).size;
          const perDay = days ? totalCredits / days : 0;
          return {
            accrualDays: days,
            monthlyAverage: Math.round(perDay * 30 * 1000) / 1000,
            projectedAnnual: Math.round(perDay * 365 * 1000) / 1000,
            projectedAnnualInr: Math.round(perDay * 365 * marketRate),
          };
        })()
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

// @desc    Calculate and add carbon credits
// @route   POST /api/carbon/calculate
// @access  Private
exports.calculateCredits = async (req, res) => {
  try {
    const { energyKWh, waterLiters, description } = req.body;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    const calculation = calculateCarbonCredits(
      energyKWh || 0,
      waterLiters || 0
    );

    const transaction = await CarbonTransaction.create({
      userId: req.user._id,
      farmId: farm._id,
      creditsEarned: calculation.credits,
      waterSavedLiters: waterLiters || 0,
      co2ReducedKg: calculation.co2Reduced,
      transactionType: "earned",
      monetaryValue: calculation.credits * 1500,
      description: description || "Carbon credits from agrivoltaic farming"
    });

    // Update user's carbon balance
    const user = req.user;
    user.carbonBalance += calculation.credits;
    await user.save();

    res.status(201).json({
      success: true,
      message: "Carbon credits calculated and added",
      data: {
        transaction,
        calculation: {
          credits: Math.round(calculation.credits * 1000) / 1000,
          co2Reduced: Math.round(calculation.co2Reduced * 100) / 100,
          breakdown: calculation.breakdown
        }
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

// @desc    Withdraw carbon credits
// @route   POST /api/carbon/withdraw
// @access  Private
exports.withdrawCredits = async (req, res) => {
  try {
    const { method, buyerId } = req.body;
    const credits = Number(req.body.credits);
    if (!(credits > 0)) return res.status(400).json({ success: false, message: "Enter a positive number of credits" });
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    // Check available balance
    const transactions = await CarbonTransaction.find({
      farmId: farm._id,
      transactionType: "earned"
    });

    const totalCredits = transactions.reduce((sum, t) => sum + t.creditsEarned, 0);
    const withdrawnTransactions = await CarbonTransaction.find({
      farmId: farm._id,
      transactionType: "withdrawn"
    });
    const withdrawnCredits = withdrawnTransactions.reduce((sum, t) => sum + t.creditsEarned, 0);
    const availableCredits = totalCredits - withdrawnCredits;

    if (credits > availableCredits) {
      return res.status(400).json({
        success: false,
        message: "Insufficient carbon credits"
      });
    }

    // Sell to a marketplace buyer at their bid, otherwise at the reference rate
    const market = require("../mlModels/carbonIntelligence").marketplace || [];
    const buyer = buyerId ? market.find((b) => b.buyer_name === buyerId || b.logo_code === buyerId) : null;
    const rate = buyer?.bid_price_per_credit || 1500;
    const transaction = await CarbonTransaction.create({
      userId: req.user._id,
      farmId: farm._id,
      creditsEarned: credits,
      transactionType: "withdrawn",
      monetaryValue: Math.round(credits * rate * 100) / 100,
      description: buyer ? `Sold to ${buyer.buyer_name || buyer.name} @ ₹${rate}/credit` : `Withdrawal via ${method || "bank transfer"}`
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted",
      data: {
        transaction,
        processingTime: "3-5 business days",
        rate,
        amount: Math.round(credits * rate * 100) / 100
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

// @desc    Get carbon credit history
// @route   GET /api/carbon/history
// @access  Private
exports.getCarbonHistory = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const farm = await Farm.findOne({ userId: req.user._id });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: "Farm not found"
      });
    }

    await ledger.ensureLedger(farm).catch((e) => console.error("ledger:", e.message));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const transactions = await CarbonTransaction.find({
      farmId: farm._id,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Generate ESG certificate
// @route   POST /api/carbon/certificate
// @access  Private
exports.generateCertificate = async (req, res) => {
  try {
    const Certificate = require("../models/Certificate");
    const days = Math.min(365, Math.max(1, parseInt(req.body?.days) || 30));
    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    await ledger.ensureLedger(farm).catch(() => {});

    const since = new Date(Date.now() - days * 86400000);
    const rows = await SolarData.find({ farmId: farm._id, date: { $gte: since }, isPartial: { $ne: true } }).sort({ date: 1 }).lean();
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "No completed generation days yet — set up solar in Settings first." });
    }
    const solarKwh = rows.reduce((s, r) => s + (r.energyProduced || 0), 0);
    const water = rows.reduce((s, r) => s + (r.waterSavedLiters || 0), 0);
    const cooling = rows.reduce((s, r) => s + (r.bioCoolingDeltaC || 0), 0) / rows.length;

    const out = esgGenerator.generateCertificate(
      { name: req.user.name, district: farm.location.district, state: farm.location.state },
      { solarKwhGenerated: solarKwh, waterSavedLiters: water, bioCoolingDegrees: cooling, days }
    );
    const origin = (process.env.FRONTEND_URL || "https://agrovolt-ai.vercel.app").replace(/\/$/, "");
    out.certificate.verificationUrl = `${origin}/verify/${out.certificate.id}`;
    out.certificate.period = { start: rows[0].day, end: rows[rows.length - 1].day, days: rows.length };

    await Certificate.create({
      certId: out.certificate.id, userId: req.user._id, farmId: farm._id, issuedTo: req.user.name,
      district: farm.location.district, state: farm.location.state,
      periodStart: rows[0].day, periodEnd: rows[rows.length - 1].day,
      solarKwh: Math.round(solarKwh * 10) / 10, waterSavedLiters: Math.round(water),
      co2AvoidedKg: out.carbonSavings.totalKgCo2, credits: out.carbonSavings.totalTonnesCo2,
      verificationHash: out.certificate.verificationHash, payload: out,
    });
    res.json({ success: true, data: out });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Public certificate verification
// @route   GET /api/carbon/verify/:certId
// @access  Public
exports.verifyCertificate = async (req, res) => {
  const Certificate = require("../models/Certificate");
  const c = await Certificate.findOne({ certId: req.params.certId }).lean();
  if (!c) return res.status(404).json({ success: false, message: "Certificate not found" });
  res.json({
    success: true,
    data: {
      certId: c.certId, issuedTo: c.issuedTo, district: c.district, state: c.state,
      issuedAt: c.createdAt, periodStart: c.periodStart, periodEnd: c.periodEnd,
      solarKwh: c.solarKwh, waterSavedLiters: c.waterSavedLiters, co2AvoidedKg: c.co2AvoidedKg, credits: c.credits,
      verificationHash: c.verificationHash, methodology: c.payload?.verification?.methodology,
    },
  });
};

// @desc    Get full carbon intelligence (SOC, methane, price forecast, yield prediction)
// @route   GET /api/carbon/intelligence
// @access  Private
exports.getIntelligence = async (req, res) => {
  try {
    const carbonIntel = require("../mlModels/carbonIntelligence");
    const farm = await Farm.findOne({ userId: req.user._id });
    const { soilType, cropType, irrigationType } = req.query;

    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    await ledger.ensureLedger(farm).catch(() => {});
    const txs = await CarbonTransaction.find({ farmId: farm._id }).sort({ timestamp: -1 }).lean();
    const earned = txs.filter((t) => t.transactionType === "earned");
    const credits = earned.reduce((s, t) => s + t.creditsEarned, 0) - txs.filter((t) => t.transactionType === "withdrawn").reduce((s, t) => s + t.creditsEarned, 0);
    const co2 = earned.reduce((s, t) => s + (t.co2ReducedKg || 0), 0);
    const water = earned.reduce((s, t) => s + (t.waterSavedLiters || 0), 0);
    const kwh = (await SolarData.aggregate([{ $match: { farmId: farm._id } }, { $group: { _id: null, k: { $sum: "$energyProduced" } } }]))[0]?.k || 0;

    const intel = carbonIntel.getFullIntelligence({
      soilType: soilType || farm.soilType || 'loamy',
      farmAreaHa: (farm.farmSize || 1) * 0.4047,
      panelCoverage: (farm.shadeCoverage ?? 35) / 100,
      cropType: cropType || (farm.cropUnderPanels && farm.cropUnderPanels !== 'general' ? farm.cropUnderPanels : 'rice'),
      irrigationType: irrigationType || 'awd',
      currentCredits: Math.max(0, Math.round(credits * 1000) / 1000),
      co2Kg: Math.round(co2),
      waterLiters: Math.round(water),
      solarKwh: Math.round(kwh),
    });
    intel.farmer_id = `AV-${String(farm._id).slice(-6).toUpperCase()}`;
    // Real ledger instead of the illustrative one
    intel.transaction_ledger = txs.slice(0, 20).map((t) => ({
      transaction_id: `TXN-${String(t._id).slice(-8).toUpperCase()}`,
      date: t.timestamp,
      type: t.transactionType === "earned" ? "MINT" : "SELL",
      description: t.description,
      credit_impact: `${t.transactionType === "earned" ? "+" : "-"}${(t.creditsEarned || 0).toFixed(4)}`,
      monetary_estimate_inr: Math.round(t.monetaryValue || 0),
      verification_status: t.transactionType === "earned" ? "VERIFIED" : "SETTLED",
      verification_hash: carbonIntel.generateVerificationHash({ id: String(t._id), credits: t.creditsEarned, day: t.sourceDay }),
      auditor_ai: t.sourceDay ? "AgroVolt Energy Ledger (Open-Meteo irradiance)" : "Manual entry",
    }));

    res.json({
      success: true,
      data: intel
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
