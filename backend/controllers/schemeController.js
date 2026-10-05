const Farm = require("../models/Farm");
const { schemes } = require("../data/pmkusum_schemes.json");

const ACRE_HECTARE_SMALL = 4.94; // ≤ 2 ha = small/marginal (Agriculture Census)

/**
 * Evaluate each scheme's published criteria against the farm profile plus the
 * farmer's answers. Unknown answers are reported as "unknown", never assumed.
 * answers: { hasDieselPump, hasGridPump, pumpHp, category: 'small'|'marginal'|'scst'|'other',
 *            availedBefore, fallowAcres, discomAgreement, dataSharing }
 */
function evaluate(s, farm, a) {
  const e = s.eligibility || {};
  const c = [];
  const add = (key, met, params = {}) => c.push({ key, met, params });
  const yn = (v) => (v === undefined || v === null || v === "" ? null : v === true || v === "true" || v === "yes");

  if (e.land_ownership_min_acres != null) add("land_min", (farm.farmSize || 0) >= e.land_ownership_min_acres, { min: e.land_ownership_min_acres, have: farm.farmSize });
  if (e.existing_pump_required) add("pump_existing", yn(a.hasDieselPump) ?? yn(a.hasGridPump));
  if (e.existing_grid_pump_required) add("pump_grid", yn(a.hasGridPump));
  if (e.max_pump_hp != null) add("pump_hp", a.pumpHp ? Number(a.pumpHp) <= e.max_pump_hp : null, { max: e.max_pump_hp });
  if (e.farmer_type && !e.farmer_type.includes("All")) {
    const cat = a.category || ((farm.farmSize || 0) <= ACRE_HECTARE_SMALL ? "small" : null);
    add("farmer_type", cat ? ["small", "marginal", "scst"].includes(cat) : null, { types: e.farmer_type.join(", ") });
  }
  if (e.not_previously_availed) add("not_availed", yn(a.availedBefore) == null ? null : !yn(a.availedBefore));
  if (e.land_type) add("fallow", a.fallowAcres != null && a.fallowAcres !== "" ? Number(a.fallowAcres) >= (e.land_ownership_min_acres || 0) : null, { min: e.land_ownership_min_acres });
  if (e.discom_agreement_required) add("discom", yn(a.discomAgreement));
  if (e.existing_solar_installation) add("solar_existing", !!farm.solarInstalled);
  if (e.growing_crops_under_panels) add("crops_under", !!farm.solarInstalled && farm.cropUnderPanels && farm.cropUnderPanels !== "general" ? true : farm.solarInstalled ? null : false);
  if (e.min_panel_capacity_kw != null) add("capacity_min", (farm.solarCapacityKW || 0) >= e.min_panel_capacity_kw, { min: e.min_panel_capacity_kw, have: farm.solarCapacityKW || 0 });
  if (e.data_sharing_agreement) add("data_sharing", yn(a.dataSharing));

  const closed = s.deadline && new Date(s.deadline + "T23:59:59+05:30") < new Date();
  const failed = c.some((x) => x.met === false);
  const unknown = c.some((x) => x.met === null);
  return {
    id: s.id, name: s.name, fullName: s.fullName, ministry: s.ministry, description: s.description,
    subsidyPct: s.subsidy_percentage, maxAmount: s.max_amount_inr, deadline: s.deadline,
    documents: s.documents_required || [], url: s.application_url,
    status: closed ? "closed" : failed ? "not_eligible" : unknown ? "needs_info" : "eligible",
    criteria: c,
  };
}

// @route POST /api/schemes/check   body: answers
exports.check = async (req, res) => {
  const farm = await Farm.findOne({ userId: req.user._id }).lean();
  if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
  const answers = req.body || {};
  res.json({ success: true, data: { farm: { sizeAcres: farm.farmSize, solar: farm.solarInstalled, capacityKW: farm.solarCapacityKW, state: farm.location?.state }, schemes: schemes.map((s) => evaluate(s, farm, answers)) } });
};
