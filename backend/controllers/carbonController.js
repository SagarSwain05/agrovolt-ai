const Farm = require("../models/Farm");
const SolarData = require("../models/SolarData");
const CarbonTransaction = require("../models/CarbonTransaction");

// Calculate carbon credits based on solar energy and water savings
const calculateCarbonCredits = (energyKWh, waterLiters) => {
  // Grid emission factor for India: ~0.82 kg CO2 per kWh
  const co2FromSolar = energyKWh * 0.82;
  
  // Water savings: 0.002 kg CO2 per liter (pumping energy saved)
  const co2FromWater = waterLiters * 0.002;
  
  const totalCO2 = co2FromSolar + co2FromWater;
  
  // 1 carbon credit = 1 ton (1000 kg) of CO2
  const credits = totalCO2 / 1000;
  
  return {
    credits,
    co2Reduced: totalCO2,
    breakdown: {
      fromSolar: co2FromSolar,
      fromWater: co2FromWater
    }
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
        insights: {
          monthlyAverage: Math.round((totalCredits / 12) * 1000) / 1000,
          projectedAnnual: Math.round((totalCredits / 12) * 12 * 1000) / 1000,
          ranking: "Top 15% in your district"
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
    const { credits, method } = req.body;
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

    const transaction = await CarbonTransaction.create({
      userId: req.user._id,
      farmId: farm._id,
      creditsEarned: credits,
      transactionType: "withdrawn",
      monetaryValue: credits * 1500,
      description: `Withdrawal via ${method || "bank transfer"}`
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted",
      data: {
        transaction,
        processingTime: "3-5 business days",
        amount: credits * 1500
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
