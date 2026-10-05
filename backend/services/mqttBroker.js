'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// AgroVolt AI — built-in MQTT broker (MQTT over secure WebSocket)
// Runs inside the API process at  wss://<backend>/mqtt  (Render exposes HTTP(S)
// only, so raw TCP 1883/8883 is not available; WebSocket transport works and is
// supported by ESP-IDF's esp-mqtt client).
//
//   username: anything (e.g. the node name)   password: the device key (avk_…)
//   publish:   agrovolt/<anything>/telemetry → same pipeline as POST /api/v1/telemetry
//   subscribe: agrovolt/<first 10 chars of the device key>/ack ← ingest results for this device only
// Devices can only publish their own telemetry and read their own acks.
// ═══════════════════════════════════════════════════════════════════════════
const { WebSocketServer, createWebSocketStream } = require('ws');
const { deviceForKey, ingest } = require('./telemetryIngest');

const state = { enabled: false, path: '/mqtt', clients: 0, received: 0, rejected: 0, lastMessageAt: null };

function attach(httpServer) {
    if (process.env.MQTT_BROKER === 'off') return state;
    const aedes = require('aedes')();
    const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

    httpServer.on('upgrade', (req, socket, head) => {
        if (!req.url || !req.url.startsWith(state.path)) return; // other upgrades (none today) untouched
        wss.handleUpgrade(req, socket, head, (ws) => {
            const stream = createWebSocketStream(ws);
            stream.on('error', () => { });
            aedes.handle(stream);
        });
    });

    aedes.authenticate = async (client, username, password, cb) => {
        try {
            const key = password ? password.toString() : '';
            const device = await deviceForKey(key);
            if (!device) { state.rejected++; const e = new Error('Bad device key'); e.returnCode = 4; return cb(e, false); }
            client.deviceKey = key;
            // Identity comes from the key itself (not the self-chosen username), so a device
            // can never read another device's acks: ack topic = agrovolt/<key prefix>/ack
            client.node = key.slice(0, 10);
            client.deviceId = String(device._id);
            cb(null, true);
        } catch (e) { cb(e, false); }
    };
    aedes.authorizePublish = (client, packet, cb) => {
        if (!client) return cb(null); // internal (broker → device acks)
        if (/^agrovolt\/[^/]+\/telemetry$/.test(packet.topic)) return cb(null);
        cb(new Error('Publish only to agrovolt/<node>/telemetry'));
    };
    aedes.authorizeSubscribe = (client, sub, cb) => {
        if (sub.topic === `agrovolt/${client.node}/ack`) return cb(null, sub);
        cb(null, null); // negate (SUBACK 0x80) without dropping the connection
    };
    aedes.on('client', () => { state.clients++; });
    aedes.on('clientDisconnect', () => { state.clients = Math.max(0, state.clients - 1); });
    aedes.on('publish', async (packet, client) => {
        if (!client || !/\/telemetry$/.test(packet.topic)) return;
        state.received++;
        state.lastMessageAt = new Date();
        let body;
        try { body = JSON.parse(packet.payload.toString()); } catch { return; }
        delete body.key;
        try {
            const out = await ingest({ key: client.deviceKey, body });
            aedes.publish({ topic: `agrovolt/${client.node}/ack`, payload: Buffer.from(JSON.stringify(out.body)), qos: 0, retain: false }, () => { });
        } catch (e) { console.error('[mqtt-broker] ingest:', e.message); }
    });
    state.enabled = true;
    console.log(`📡 MQTT broker listening on ws(s)://…${state.path}`);
    return state;
}

module.exports = { attach, status: () => state };
