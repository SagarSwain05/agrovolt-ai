'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — MQTT bridge (optional; enabled when MQTT_URL is set)
// Devices publish JSON to  <prefix>/<deviceName>/telemetry  with the device key
// in the payload: { "key": "avk_…", "soil_moisture_pct": 31.5, … }.
// Works with any broker (HiveMQ Cloud, EMQX, Mosquitto). Render web services
// only expose HTTP, so the backend connects *out* to the broker as a client.
// Results are published back to <prefix>/<deviceName>/ack.
// ═══════════════════════════════════════════════════════════════════════════
const { ingest } = require('./telemetryIngest');

let client = null;
const status = { enabled: false, connected: false, lastMessageAt: null, received: 0, errors: 0 };

function start() {
    const url = process.env.MQTT_URL;
    if (!url) return status;
    const mqtt = require('mqtt');
    const prefix = process.env.MQTT_TOPIC_PREFIX || 'agrovolt';
    status.enabled = true;
    client = mqtt.connect(url, {
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        clientId: `agrovolt-backend-${Math.random().toString(16).slice(2, 8)}`,
        reconnectPeriod: 10000,
    });
    client.on('connect', () => {
        status.connected = true;
        client.subscribe(`${prefix}/+/telemetry`, { qos: 1 });
        console.log(`📡 MQTT bridge connected (${prefix}/+/telemetry)`);
    });
    client.on('close', () => { status.connected = false; });
    client.on('error', (e) => { status.errors++; console.error('[mqtt]', e.message); });
    client.on('message', async (topic, payload) => {
        status.received++;
        status.lastMessageAt = new Date();
        let body;
        try { body = JSON.parse(payload.toString()); } catch { status.errors++; return; }
        const key = body.key || body.device_key;
        delete body.key; delete body.device_key;
        try {
            const out = await ingest({ key, body });
            client.publish(topic.replace(/\/telemetry$/, '/ack'), JSON.stringify(out.body), { qos: 0 });
        } catch (e) { status.errors++; console.error('[mqtt] ingest:', e.message); }
    });
    return status;
}

module.exports = { start, status: () => status };
