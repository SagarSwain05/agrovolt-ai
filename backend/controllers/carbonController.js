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
    const origin = (/^https?:\/\//.test(process.env.FRONTEND_URL || "") ? process.env.FRONTEND_URL : "https://agrovolt-ai.vercel.app").replace(/\/$/, "");
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

// @desc    MRV audit export
// @route   GET /api/carbon/mrv?from=&to=&format=json|csv|hourly-csv|pdf
// @access  Private
exports.getMrv = async (req, res) => {
  try {
    const mrv = require("../services/mrv");
    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    if (!farm.solarInstalled) return res.status(400).json({ success: false, message: "Set up solar in Settings first." });
    await ledger.ensureLedger(farm).catch(() => {});
    const { from, to } = req.query;
    const fmt = String(req.query.format || "json");
    if (fmt === "hourly-csv") {
      const rows = await mrv.hourly(farm, { from, to });
      res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="agrovolt-hourly-${Date.now()}.csv"` });
      return res.send(mrv.toCsv(rows));
    }
    const report = await mrv.build(farm, req.user, { from, to });
    if (fmt === "csv") {
      res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${report.reportId}.csv"` });
      const head = `# ${report.reportId}; farm ${report.project.farmCode}; grid EF ${report.baseline.gridEmissionFactorKgPerKwh} kg/kWh; sha256 ${report.datasetSha256}\n`;
      return res.send(head + mrv.toCsv(report.daily));
    }
    if (fmt === "pdf") {
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report.reportId}.pdf"` });
      return mrv.toPdf(report, res);
    }
    res.json({ success: true, data: report });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not build MRV report" });
  }
};

// @desc    Programme of Activities (PoA) bundle — aggregate smallholder farms
//          into one programmatic carbon project (anonymised component list)
// @route   GET /api/carbon/poa?state=&district=&format=json|csv
// @access  Private
exports.getPoa = async (req, res) => {
  try {
    const own = await Farm.findOne({ userId: req.user._id }).lean();
    const state = req.query.state || own?.location?.state || "Odisha";
    const district = req.query.district ?? "";
    const q = { "location.state": state, solarInstalled: true };
    if (district) q["location.district"] = district;
    const farms = await Farm.find(q).select("_id location.district solarCapacityKW solarSince isHardwareVerified cropUnderPanels").lean();
    const agg = await SolarData.aggregate([
      { $match: { farmId: { $in: farms.map((f) => f._id) }, isPartial: { $ne: true } } },
      { $group: { _id: { farm: "$farmId", src: "$source" }, kwh: { $sum: "$energyProduced" }, co2: { $sum: "$co2AvoidedKg" }, days: { $sum: 1 }, first: { $min: "$day" }, last: { $max: "$day" } } },
    ]);
    const by = {};
    for (const a of agg) {
      const k = String(a._id.farm);
      by[k] ||= { kwh: 0, co2: 0, meteredKwh: 0, meteredCo2: 0, days: 0, first: a.first, last: a.last };
      by[k].kwh += a.kwh; by[k].co2 += a.co2 || 0; by[k].days += a.days;
      if (a._id.src === "device") { by[k].meteredKwh += a.kwh; by[k].meteredCo2 += a.co2 || 0; }
      if (a.first < by[k].first) by[k].first = a.first;
      if (a.last > by[k].last) by[k].last = a.last;
    }
    const components = farms.map((f) => {
      const s = by[String(f._id)] || { kwh: 0, co2: 0, meteredKwh: 0, meteredCo2: 0, days: 0 };
      return {
        cpa: `AV-${String(f._id).slice(-6).toUpperCase()}`, district: f.location?.district || "", capacityKWp: f.solarCapacityKW,
        commissioned: f.solarSince ? new Date(f.solarSince).toISOString().slice(0, 10) : "", hardwareVerified: !!f.isHardwareVerified,
        days: s.days, energyKwh: Math.round(s.kwh * 10) / 10, co2Kg: Math.round(s.co2), verifiableCo2Kg: Math.round(s.meteredCo2),
        vintageFrom: s.first || "", vintageTo: s.last || "",
      };
    }).filter((c) => c.days > 0);
    const totals = components.reduce((t, c) => ({ cpas: t.cpas + 1, capacityKWp: t.capacityKWp + (c.capacityKWp || 0), energyKwh: t.energyKwh + c.energyKwh, co2Kg: t.co2Kg + c.co2Kg, verifiableCo2Kg: t.verifiableCo2Kg + c.verifiableCo2Kg }), { cpas: 0, capacityKWp: 0, energyKwh: 0, co2Kg: 0, verifiableCo2Kg: 0 });
    totals.credits = Math.round(totals.co2Kg) / 1000;
    totals.verifiableCredits = Math.round(totals.verifiableCo2Kg) / 1000;
    if (req.query.format === "csv") {
      const mrv = require("../services/mrv");
      res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="agrovolt-poa-${state}${district ? "-" + district : ""}.csv"` });
      return res.send(`# AgroVolt PoA bundle ${state}${district ? " / " + district : ""}; ${totals.cpas} CPAs; ${totals.credits} tCO2e (${totals.verifiableCredits} metered)\n` + mrv.toCsv(components));
    }
    res.json({
      success: true,
      data: {
        scope: { state, district: district || null }, totals, components,
        notes: [
          "Each farm is a Component Project Activity (CPA) under one AgroVolt-coordinated programme.",
          "Only metered (hardware-verified) days count as verifiable; modelled days are estimates for planning.",
          "Registration requires a validation body (DOE) and a registry: India CCTS, Verra VCS or Gold Standard.",
        ],
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
