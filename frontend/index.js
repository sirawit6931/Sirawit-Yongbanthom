// ─── Polyfill: MUST be require() NOT import — Babel hoists imports ────────────
require('./polyfills');

// ─── App entry ────────────────────────────────────────────────────────────────
const { registerRootComponent } = require('expo');
const { default: App } = require('./App');

registerRootComponent(App);
