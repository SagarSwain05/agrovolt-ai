/* eslint-disable no-console */
// Remove test accounts (…@agrovolt.test) with all their data and (re)create the demo accounts.
// Usage:  node scripts/seedDemo.js            → dry run (lists what would change)
//         node scripts/seedDemo.js --apply    → apply
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const APPLY = process.argv.includes("--apply");
const TEST = /@agrovolt\.test$/i;
const PASSWORD = process.env.DEMO_PASSWORD || "Demo@2026";
const DAY = 86400e3;

const DEMO = [
  { email: "farmer@agrovolt.demo", name: "Sabita Nayak", language: "or", role: "farmer", phone: "9437000001",
    farm: { farmName: "Sabita's Agrivoltaic Farm", farmSize: 2, soilType: "laterite", location: { latitude: 20.1814, longitude: 85.6188, district: "Khordha", state: "Odisha" },
      solarInstalled: true, solarCapacityKW: 5, panelCount: 12, panelTilt: 30, shadeCoverage: 40, cropUnderPanels: "tomato", tariffPerKwh: 6, annualRainfall: 1450, solarSince: new Date(Date.now() - 75 * DAY) },
    crops: [{ cropName: "Tomato", season: "kharif", sow: 45, days: 110 }, { cropName: "Turmeric", season: "kharif", sow: 120, days: 240 }] },
  { email: "kisan@agrovolt.demo", name: "Ramesh Kumar", language: "hi", role: "farmer", phone: "9437000002",
    farm: { farmName: "Ramesh Kumar Farm", farmSize: 3, soilType: "alluvial", location: { latitude: 20.4625, longitude: 85.8830, district: "Cuttack", state: "Odisha" },
      solarInstalled: true, solarCapacityKW: 3, panelCount: 8, panelTilt: 22, shadeCoverage: 30, cropUnderPanels: "rice", tariffPerKwh: 5.5, annualRainfall: 1500, solarSince: new Date(Date.now() - 40 * DAY) },
    crops: [{ cropName: "Rice", season: "kharif", sow: 70, days: 120 }] },
  { email: "epc@agrovolt.demo", name: "Ravi Das", language: "en", role: "epc", organization: "Kalinga Solar EPC (demo)", partnerCode: "EPC-DEMO01", phone: "9437000003",
    farm: { farmName: "Kalinga Solar office", farmSize: 1, location: { latitude: 20.2961, longitude: 85.8245, district: "Khordha", state: "Odisha" } } },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {});
  const M = (n) => require(`../models/${n}`);
  const User = M("User"), Farm = M("Farm");
  const byFarm = ["SolarData", "CarbonTransaction", "DiseaseScan", "Crop", "Telemetry", "Device", "TiltLog", "Certificate"].map(M);
  const byUser = [[M("Notification"), "userId"], [M("PriceReport"), "userId"], [M("PartnerKey"), "ownerId"]];

  const all = await User.find({}).select("email name role createdAt").lean();
  const victims = all.filter((u) => TEST.test(u.email) || /^probe\d+@/i.test(u.email) || /@agrovolt\.demo$/i.test(u.email));
  const keep = all.filter((u) => !victims.includes(u));
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} on ${mongoose.connection.name}`);
  console.log(`Users total ${all.length}; removing ${victims.length} test/demo accounts; keeping ${keep.length}:`);
  keep.forEach((u) => console.log(`  keep  ${u.email}  (${u.name}, ${u.role})`));

  if (!APPLY) { await mongoose.disconnect(); return; }

  const ids = victims.map((u) => u._id);
  const farms = await Farm.find({ userId: { $in: ids } }).select("_id").lean();
  const farmIds = farms.map((f) => f._id);
  for (const Model of byFarm) { const r = await Model.deleteMany({ farmId: { $in: farmIds } }); if (r.deletedCount) console.log(`  deleted ${r.deletedCount} ${Model.modelName}`); }
  for (const [Model, f] of byUser) { const r = await Model.deleteMany({ [f]: { $in: ids } }); if (r.deletedCount) console.log(`  deleted ${r.deletedCount} ${Model.modelName}`); }
  await Farm.updateMany({ epcPartnerId: { $in: ids } }, { $unset: { epcPartnerId: 1 } });
  console.log(`  deleted ${(await Farm.deleteMany({ _id: { $in: farmIds } })).deletedCount} Farm`);
  console.log(`  deleted ${(await User.deleteMany({ _id: { $in: ids } })).deletedCount} User`);

  // Create demo accounts
  const hash = await bcrypt.hash(PASSWORD, 10);
  const Crop = M("Crop");
  const made = {};
  for (const d of DEMO) {
    const user = await User.create({ name: d.name, email: d.email, password: hash, phone: d.phone, role: d.role, language: d.language, emailVerified: true,
      ...(d.organization ? { organization: d.organization, partnerCode: d.partnerCode } : {}) });
    const farm = await Farm.create({ userId: user._id, ...d.farm });
    user.farmId = farm._id; await user.save();
    for (const c of d.crops || []) {
      await Crop.create({ farmId: farm._id, cropName: c.cropName, season: c.season, sowingDate: new Date(Date.now() - c.sow * DAY), expectedHarvestDate: new Date(Date.now() + (c.days - c.sow) * DAY), status: "growing" });
    }
    made[d.email] = { user, farm };
    console.log(`  created ${d.email} (${d.role})`);
  }
  const epc = made["epc@agrovolt.demo"].user;
  await Farm.updateMany({ _id: { $in: [made["farmer@agrovolt.demo"].farm._id, made["kisan@agrovolt.demo"].farm._id] } }, { epcPartnerId: epc._id });

  // Build energy & carbon ledgers from real weather
  const ledger = require("../services/energyLedger");
  for (const e of ["farmer@agrovolt.demo", "kisan@agrovolt.demo"]) {
    const f = await Farm.findById(made[e].farm._id);
    console.log(`  ledger ${e}:`, JSON.stringify(await ledger.ensureLedger(f, { force: true }).catch((x) => x.message)));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
