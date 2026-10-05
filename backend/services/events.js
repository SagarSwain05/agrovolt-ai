'use strict';
// In-process event bus (telemetry → SSE push, alerts → notifications/webhooks).
const { EventEmitter } = require('events');
const bus = new EventEmitter();
bus.setMaxListeners(500);
module.exports = bus;
