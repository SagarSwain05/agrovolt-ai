'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — transactional email via Brevo (BREVO_API_KEY, EMAIL_FROM)
// Used for sign-up verification codes, password reset and alert emails, in
// English / हिन्दी / ଓଡ଼ିଆ. A daily cap keeps us inside the Brevo free plan.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');

const DAILY_CAP = Number(process.env.EMAIL_DAILY_CAP) || 280; // Brevo free = 300/day
const PER_USER_ALERTS_PER_DAY = 4;
const counters = { day: '', total: 0, perUser: new Map() };

function isConfigured() {
    return !!(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

function bump(userKey) {
    const day = new Date().toISOString().slice(0, 10);
    if (counters.day !== day) { counters.day = day; counters.total = 0; counters.perUser.clear(); }
    counters.total++;
    if (userKey) counters.perUser.set(userKey, (counters.perUser.get(userKey) || 0) + 1);
}
function underCap(userKey, perUserLimit) {
    const day = new Date().toISOString().slice(0, 10);
    if (counters.day !== day) return true;
    if (counters.total >= DAILY_CAP) return false;
    return !userKey || !perUserLimit || (counters.perUser.get(userKey) || 0) < perUserLimit;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, bodyHtml) {
    return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:'Noto Sans','Noto Sans Oriya','Noto Sans Devanagari',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#047857;padding:18px 24px;color:#fff;font-size:18px;font-weight:700">⚡ AgroVolt AI</td></tr>
<tr><td style="padding:24px;color:#1f2937;font-size:15px;line-height:1.6"><h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>${bodyHtml}</td></tr>
<tr><td style="padding:14px 24px;background:#f9fafb;color:#6b7280;font-size:12px">AgroVolt AI · agrovolt-ai.vercel.app</td></tr>
</table></td></tr></table></body></html>`;
}

const OTP_TEXT = {
    verify: {
        en: { subject: 'Your AgroVolt verification code', title: 'Verify your email', line: 'Enter this code in AgroVolt to finish creating your account:', note: 'The code expires in 10 minutes. If you did not sign up, ignore this email.' },
        hi: { subject: 'आपका AgroVolt सत्यापन कोड', title: 'अपना ईमेल सत्यापित करें', line: 'खाता बनाना पूरा करने के लिए AgroVolt में यह कोड डालें:', note: 'कोड 10 मिनट में समाप्त हो जाएगा। अगर आपने साइन अप नहीं किया, तो इस ईमेल को अनदेखा करें।' },
        or: { subject: 'ଆପଣଙ୍କ AgroVolt ଯାଞ୍ଚ କୋଡ୍', title: 'ଆପଣଙ୍କ ଇମେଲ ଯାଞ୍ଚ କରନ୍ତୁ', line: 'ଖାତା ଖୋଲିବା ସମ୍ପୂର୍ଣ୍ଣ କରିବାକୁ AgroVolt ରେ ଏହି କୋଡ୍ ଦିଅନ୍ତୁ:', note: 'କୋଡ୍ 10 ମିନିଟରେ ଶେଷ ହେବ। ଆପଣ ସାଇନ୍ ଅପ୍ କରିନଥିଲେ ଏହି ଇମେଲକୁ ଅଣଦେଖା କରନ୍ତୁ।' },
    },
    reset: {
        en: { subject: 'Reset your AgroVolt password', title: 'Password reset code', line: 'Use this code to set a new password:', note: 'The code expires in 10 minutes. If you did not ask for this, your password is unchanged.' },
        hi: { subject: 'अपना AgroVolt पासवर्ड रीसेट करें', title: 'पासवर्ड रीसेट कोड', line: 'नया पासवर्ड सेट करने के लिए यह कोड इस्तेमाल करें:', note: 'कोड 10 मिनट में समाप्त हो जाएगा। अगर आपने अनुरोध नहीं किया, तो आपका पासवर्ड नहीं बदला है।' },
        or: { subject: 'ଆପଣଙ୍କ AgroVolt ପାସୱାର୍ଡ ରିସେଟ୍ କରନ୍ତୁ', title: 'ପାସୱାର୍ଡ ରିସେଟ୍ କୋଡ୍', line: 'ନୂଆ ପାସୱାର୍ଡ ସେଟ୍ କରିବାକୁ ଏହି କୋଡ୍ ବ୍ୟବହାର କରନ୍ତୁ:', note: 'କୋଡ୍ 10 ମିନିଟରେ ଶେଷ ହେବ। ଆପଣ ଅନୁରୋଧ କରିନଥିଲେ ଆପଣଙ୍କ ପାସୱାର୍ଡ ବଦଳିନାହିଁ।' },
    },
};

// Reserved/test domains never receive real mail (protects the sender reputation)
const NO_SEND = /@([\w-]+\.)*(test|example|invalid|localhost|demo)$|@example\.(com|org|net)$/i;
const outbox = []; // last few dry-run messages (dev / tests)

async function send({ to, name, subject, html, text, userKey, perUserLimit }) {
    if (process.env.EMAIL_DRY_RUN === 'true' || NO_SEND.test(String(to))) {
        outbox.push({ to, subject, text, at: new Date() });
        if (outbox.length > 50) outbox.shift();
        console.log(`[email:dry-run] to=${to} subject="${subject}"`);
        return;
    }
    if (!isConfigured()) throw new Error('Email not configured');
    if (!underCap(userKey, perUserLimit)) throw new Error('Daily email limit reached');
    await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME || 'AgroVolt AI' },
        to: [{ email: to, ...(name ? { name } : {}) }],
        subject, htmlContent: html, textContent: text,
    }, { headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 });
    bump(userKey);
}

async function sendOtp({ to, name, code, purpose = 'verify', lang = 'en' }) {
    const t = (OTP_TEXT[purpose] || OTP_TEXT.verify)[lang] || OTP_TEXT[purpose].en;
    const html = layout(t.title, `<p>${esc(t.line)}</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#047857;margin:18px 0">${esc(code)}</p>
<p style="color:#6b7280;font-size:13px">${esc(t.note)}</p>`);
    await send({ to, name, subject: `${t.subject}: ${code}`, html, text: `${t.line} ${code}\n${t.note}` });
}

async function sendAlert({ to, name, title, body, url, level, userKey }) {
    const color = level === 'high' ? '#dc2626' : level === 'medium' ? '#d97706' : '#047857';
    const link = `${(process.env.FRONTEND_URL || 'https://agrovolt-ai.vercel.app').replace(/\/$/, '')}${url || '/dashboard'}`;
    const html = layout(title, `<p style="border-left:4px solid ${color};padding-left:12px">${esc(body)}</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#047857;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">AgroVolt AI →</a></p>`);
    await send({ to, name, subject: `AgroVolt: ${title}`, html, text: `${title}\n${body}\n${link}`, userKey, perUserLimit: PER_USER_ALERTS_PER_DAY });
}

module.exports = { isConfigured, sendOtp, sendAlert, outbox: () => outbox, status: () => ({ configured: isConfigured(), day: counters.day, sentToday: counters.total, cap: DAILY_CAP }) };
