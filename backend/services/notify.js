'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — Notification delivery
// Always: in-app (MongoDB). Optional per user preference + server config:
//  • Email via Brevo (verified addresses; BREVO_API_KEY, EMAIL_FROM)
//  • Web Push (free, VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
//  • SMS / WhatsApp via Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//    TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM)
//  • WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID) — note Meta only
//    allows free-form text inside a 24 h user-initiated window; outside it an
//    approved template (WHATSAPP_TEMPLATE) is used.
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');
const Notification = require('../models/Notification');
const User = require('../models/User');

const LEVEL = { info: 0, medium: 1, high: 2 };

let webpush = null;
function push() {
    if (webpush !== null) return webpush;
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return (webpush = false);
    webpush = require('web-push');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@agrovolt.ai', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    return webpush;
}

function e164(phone) {
    const d = String(phone || '').replace(/[^\d+]/g, '');
    if (!d) return null;
    if (d.startsWith('+')) return d;
    if (d.length === 10) return '+91' + d;
    if (d.length === 12 && d.startsWith('91')) return '+' + d;
    return null;
}

async function twilio(to, body, whatsapp) {
    const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
    const from = whatsapp ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_SMS_FROM;
    if (!sid || !tok || !from) throw new Error('Twilio not configured');
    const params = new URLSearchParams({ To: whatsapp ? `whatsapp:${to}` : to, From: whatsapp ? `whatsapp:${from.replace(/^whatsapp:/, '')}` : from, Body: body.slice(0, 1500) });
    await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, params, { auth: { username: sid, password: tok }, timeout: 15000 });
}

async function whatsappCloud(to, title, body) {
    const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) throw new Error('WhatsApp Cloud not configured');
    const tpl = process.env.WHATSAPP_TEMPLATE;
    const payload = tpl
        ? { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'template', template: { name: tpl, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: title }, { type: 'text', text: body.slice(0, 900) }] }] } }
        : { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body: `${title}\n${body}`.slice(0, 4000) } };
    await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/messages`, payload, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
}

function channelsAvailable() {
    return {
        email: require('./email').isConfigured(),
        push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_SMS_FROM),
        whatsapp: !!((process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_FROM) || (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)),
    };
}

/**
 * Create (deduplicated) and deliver a notification.
 * @returns the Notification document, or null if it was a duplicate.
 */
async function send(userId, { type = 'system', level = 'info', title, body, data, dedupeKey, lang }) {
    let n;
    try {
        n = await Notification.create({ userId, type, level, title, body, data, dedupeKey, lang });
    } catch (e) {
        if (e.code === 11000) return null; // already sent
        throw e;
    }
    const user = await User.findById(userId);
    if (!user) return n;
    const prefs = user.notificationPrefs || {};
    if (LEVEL[level] < LEVEL[prefs.minLevel || 'medium']) return n;
    const avail = channelsAvailable();
    const errors = [];
    const sent = { inApp: true };

    if (prefs.push !== false && avail.push && user.pushSubscriptions?.length) {
        const wp = push();
        const payload = JSON.stringify({ title, body, url: data?.url || '/dashboard', tag: dedupeKey || type, level });
        const dead = [];
        for (const sub of user.pushSubscriptions) {
            try { await wp.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 6 * 3600 }); sent.push = true; }
            catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint); else errors.push('push: ' + e.message); }
        }
        if (dead.length) { user.pushSubscriptions = user.pushSubscriptions.filter((s) => !dead.includes(s.endpoint)); await user.save(); }
    }
    if (prefs.email !== false && avail.email && user.email && user.emailVerified !== false) {
        try {
            await require('./email').sendAlert({ to: user.email, name: user.name, title, body, url: data?.url, level, userKey: String(user._id) });
            sent.email = true;
        } catch (e) { errors.push('email: ' + e.message); }
    }
    const to = e164(user.phone);
    if (to && prefs.sms && avail.sms) {
        try { await twilio(to, `${title}: ${body}`, false); sent.sms = true; } catch (e) { errors.push('sms: ' + e.message); }
    }
    if (to && prefs.whatsapp && avail.whatsapp) {
        try {
            if (process.env.WHATSAPP_TOKEN) await whatsappCloud(to, title, body); else await twilio(to, `*${title}*\n${body}`, true);
            sent.whatsapp = true;
        } catch (e) { errors.push('whatsapp: ' + e.message); }
    }
    n.channels = sent;
    n.deliveryErrors = errors;
    await n.save();
    return n;
}

module.exports = { send, channelsAvailable, e164 };
