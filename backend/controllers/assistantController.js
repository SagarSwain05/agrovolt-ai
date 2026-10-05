const { buildContext, renderActions } = require("../services/farmContext");
const fallback = require("../services/assistantFallback");
const llm = require("../services/llm");
const tts = require("../services/tts");
const i18n = require("../services/i18n");

const LANG_NAME = { en: "English", hi: "Hindi (Devanagari script)", or: "Odia (Odia script)" };
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

// Per-user sliding-window limiter (protects the free LLM quota)
const hits = new Map();
function allow(userId, limit = 20, windowMs = 60000) {
  const now = Date.now();
  const arr = (hits.get(userId) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  hits.set(userId, arr);
  return true;
}

/** Script of the text decides the reply language when it is unambiguous. */
function scriptLang(text) {
  if (/[଀-୿]/.test(text)) return "or";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  return null;
}

function compactContext(ctx, lang) {
  const c = JSON.parse(JSON.stringify(ctx));
  if (c.solar) c.solar.daily = c.solar.daily.slice(-7);
  c.forecast = c.forecast.slice(0, 5).map(({ date, day, tempMax, tempMin, rain, rainChance, description, radiationKwhM2 }) =>
    ({ date, day, tempMax, tempMin, rain, rainChance, description, radiationKwhM2 }));
  c.actions = renderActions(ctx.actions, lang).map((a) => a.text);
  return c;
}

function systemPrompt(ctx, lang) {
  return [
    "You are Sahayak, the voice assistant of AgroVolt AI — an agrivoltaic (solar + farming) platform for small farmers in India.",
    `Always reply in ${LANG_NAME[lang]}. Use simple words a farmer with little schooling understands. For Odia and Hindi use the native script, not English letters.`,
    "Replies are spoken aloud: 1–4 short sentences, no markdown, no lists, no emojis. Say numbers with units (°C, kWh, ₹ per quintal, litres).",
    "Ground every farm-specific claim in the LIVE FARM DATA below. If the data does not contain the answer, say so briefly and give general, safe agronomy advice.",
    "Prefer organic / low-toxicity treatments and always mention safety for any chemical. Never invent prices, subsidies amounts or sensor readings.",
    "The 'sensors' block with source 'virtual' is modelled from live weather, not a physical probe; mention this only if the user asks about sensors.",
    "",
    "LIVE FARM DATA (JSON):",
    JSON.stringify(compactContext(ctx, lang)),
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING", description: "Exact transcription of the user's spoken audio in its original script; empty if no audio." },
    language: { type: "STRING", enum: ["en", "hi", "or"], description: "Language the user spoke or wrote in." },
    reply: { type: "STRING", description: "Spoken-style answer." },
  },
  required: ["reply", "language"],
};

// @route POST /api/assistant/chat
// body: { message?, audio?: { mimeType, data(base64) }, lang: 'en'|'hi'|'or', history?: [{role,text}] }
exports.chat = async (req, res) => {
  try {
    if (!allow(String(req.user._id))) {
      return res.status(429).json({ success: false, message: "Too many requests, please wait a moment." });
    }
    const { message = "", audio, history = [] } = req.body || {};
    let lang = i18n.normLang(req.body?.lang || req.user.language);
    if (!message && !audio?.data) return res.status(400).json({ success: false, message: "message or audio is required" });
    if (audio?.data && Buffer.byteLength(audio.data, "base64") > MAX_AUDIO_BYTES) {
      return res.status(413).json({ success: false, message: "Audio too long" });
    }

    const ctx = await buildContext(req.user);
    if (!ctx) return res.status(404).json({ success: false, message: "Farm not found. Complete your profile in Settings." });

    const typedLang = scriptLang(message);
    if (typedLang) lang = typedLang;

    // 1) LLM path (Gemini): handles free-form questions and audio in one call
    const ai = await llm.generate({
      system: systemPrompt(ctx, lang),
      history: Array.isArray(history) ? history : [],
      text: audio?.data
        ? `The user spoke the attached audio (expected language: ${LANG_NAME[lang]}). Transcribe it, then answer it. ${message}`.trim()
        : message,
      audio: audio?.data ? { mimeType: String(audio.mimeType || "audio/webm").split(";")[0], data: audio.data } : undefined,
      schema: RESPONSE_SCHEMA,
    });
    if (ai?.json?.reply) {
      const outLang = scriptLang(ai.json.reply) || lang;
      return res.json({
        success: true,
        data: {
          reply: ai.json.reply,
          transcript: audio?.data ? ai.json.transcript || "" : message,
          lang: outLang,
          source: "gemini",
          model: ai.model,
        },
      });
    }

    // 2) Rule-based path on live data
    if (!message) {
      return res.status(503).json({
        success: false,
        code: "speech_unavailable",
        message: "Server speech recognition is unavailable. Please type your question or use Chrome/Edge for voice.",
      });
    }
    const r = fallback.answer(message, lang, ctx, renderActions);
    res.json({ success: true, data: { reply: r.reply, transcript: message, lang, source: "rules", intent: r.intent } });
  } catch (e) {
    console.error("[assistant]", e);
    res.status(500).json({ success: false, message: "Assistant error" });
  }
};

// @route POST /api/assistant/tts  body: { text, lang }  → audio/mpeg
exports.speak = async (req, res) => {
  try {
    if (!allow("tts:" + req.user._id, 40)) return res.status(429).end();
    const lang = i18n.normLang(req.body?.lang);
    const out = await tts.synthesize(req.body?.text, lang);
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": out.audio.length,
      "Cache-Control": "private, max-age=86400",
      "X-TTS-Voice": out.voice,
      "X-TTS-Transliterated": String(out.transliterated),
    });
    res.send(out.audio);
  } catch (e) {
    console.error("[tts]", e.message);
    res.status(502).json({ success: false, message: "Speech synthesis unavailable" });
  }
};

// @route GET /api/assistant/briefing?lang=  — today's spoken briefing + actions
exports.briefing = async (req, res) => {
  try {
    const lang = i18n.normLang(req.query.lang || req.user.language);
    const ctx = await buildContext(req.user);
    if (!ctx) return res.status(404).json({ success: false, message: "Farm not found" });
    const actions = renderActions(ctx.actions, lang);
    const w = fallback.answer("weather", lang, ctx, renderActions).reply;
    res.json({ success: true, data: { lang, weather: w, actions, text: [w, ...actions.slice(0, 2).map((a) => a.text)].join(" ") } });
  } catch (e) {
    console.error("[briefing]", e);
    res.status(500).json({ success: false, message: "Briefing error" });
  }
};

// @route GET /api/assistant/status
exports.status = (req, res) => {
  res.json({
    success: true,
    data: {
      llm: llm.isConfigured() ? "gemini" : "rules",
      languages: ["en", "hi", "or"],
      serverTts: { en: "en-IN-NeerjaNeural", hi: "hi-IN-SwaraNeural", or: "hi-IN-SwaraNeural (transliterated fallback)" },
      serverStt: llm.isConfigured(),
    },
  });
};
