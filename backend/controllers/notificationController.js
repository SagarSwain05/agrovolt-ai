const Notification = require("../models/Notification");
const User = require("../models/User");
const Farm = require("../models/Farm");
const Crop = require("../models/Crop");
const Telemetry = require("../models/Telemetry");
const notify = require("../services/notify");
const diseaseRisk = require("../services/diseaseRisk");
const { riskMessage } = require("../services/scheduler");
const i18n = require("../services/i18n");

// @route GET /api/notifications
exports.list = async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, data: { items, unread: items.filter((n) => !n.read).length } });
};

// @route POST /api/notifications/read   { ids?: [] } (all when omitted)
exports.markRead = async (req, res) => {
  const q = { userId: req.user._id };
  if (Array.isArray(req.body?.ids) && req.body.ids.length) q._id = { $in: req.body.ids };
  await Notification.updateMany(q, { read: true });
  res.json({ success: true });
};

// @route GET /api/notifications/config — VAPID key, channels the server can deliver, user prefs
exports.config = async (req, res) => {
  const user = await User.findById(req.user._id).select("notificationPrefs phone pushSubscriptions email emailVerified");
  res.json({
    success: true,
    data: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
      available: notify.channelsAvailable(),
      prefs: user.notificationPrefs || {},
      phone: user.phone || null,
      email: user.email,
      emailVerified: user.emailVerified !== false,
      pushDevices: user.pushSubscriptions?.length || 0,
    },
  });
};

// @route POST /api/notifications/subscribe   PushSubscription JSON
exports.subscribe = async (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh) return res.status(400).json({ success: false, message: "Invalid subscription" });
  const user = await User.findById(req.user._id);
  user.pushSubscriptions = [...(user.pushSubscriptions || []).filter((s) => s.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: sub.keys }].slice(-5);
  await user.save();
  res.json({ success: true, devices: user.pushSubscriptions.length });
};

// @route PUT /api/notifications/prefs   { push, sms, whatsapp, minLevel }
exports.prefs = async (req, res) => {
  const user = await User.findById(req.user._id);
  const p = { ...(user.notificationPrefs?.toObject?.() || user.notificationPrefs || {}) };
  for (const k of ["email", "push", "sms", "whatsapp"]) if (typeof req.body?.[k] === "boolean") p[k] = req.body[k];
  if (["info", "medium", "high"].includes(req.body?.minLevel)) p.minLevel = req.body.minLevel;
  user.notificationPrefs = p;
  await user.save();
  res.json({ success: true, data: user.notificationPrefs });
};

// @route POST /api/notifications/test — sends a test alert through every enabled channel
exports.test = async (req, res) => {
  const lang = i18n.normLang(req.user.language);
  const title = { en: "AgroVolt test alert", hi: "AgroVolt परीक्षण सूचना", or: "AgroVolt ପରୀକ୍ଷା ସୂଚନା" }[lang];
  const body = { en: "Alerts are working on this device.", hi: "इस डिवाइस पर सूचनाएं काम कर रही हैं।", or: "ଏହି ଡିଭାଇସରେ ସୂଚନା କାମ କରୁଛି।" }[lang];
  const n = await notify.send(req.user._id, { type: "system", level: "high", title, body, lang, dedupeKey: `test|${Date.now()}` });
  res.json({ success: true, data: n });
};

// @route GET /api/notifications/risk?lang= — current microclimate disease risk for the farm
exports.risk = async (req, res) => {
  try {
    const lang = i18n.normLang(req.query.lang || req.user.language);
    const farm = await Farm.findOne({ userId: req.user._id });
    if (!farm) return res.status(404).json({ success: false, message: "Farm not found" });
    const [crops, device] = await Promise.all([
      Crop.find({ farmId: farm._id, status: { $ne: "harvested" } }).lean(),
      Telemetry.findOne({ farmId: farm._id, source: "device", ts: { $gte: new Date(Date.now() - 3600e3) } }).sort({ ts: -1 }).lean(),
    ]);
    const r = await diseaseRisk.assess(farm, crops, device);
    r.risks = r.risks.map((x) => ({ ...x, ...riskMessage(x, lang) }));
    res.json({ success: true, data: r });
  } catch (e) {
    console.error(e);
    res.status(502).json({ success: false, message: "Risk model unavailable" });
  }
};
