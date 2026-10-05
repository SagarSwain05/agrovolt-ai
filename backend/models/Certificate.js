const mongoose = require("mongoose");

// Issued ESG / carbon-offset certificate. Publicly verifiable by certId.
const CertificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true },
    issuedTo: String,
    district: String,
    state: String,
    periodStart: String,
    periodEnd: String,
    solarKwh: Number,
    waterSavedLiters: Number,
    co2AvoidedKg: Number,
    credits: Number,
    verificationHash: String,
    payload: Object
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", CertificateSchema);
