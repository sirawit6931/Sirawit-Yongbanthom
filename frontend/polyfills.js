// polyfills.js — Hermes compatibility shims
// Must be loaded via require() in index.js (NOT import) to avoid Babel hoisting.

// ─── DOMException ────────────────────────────────────────────────────────────
// Hermes on React Native does not expose DOMException globally.
// Firebase Firestore's React Native bundle references it as a type check only,
// but we define it here as a safety net in case any other module needs it.
(function () {
  var hasDOMException = false;
  try {
    hasDOMException = typeof global.DOMException === 'function';
  } catch (_) {
    hasDOMException = false;
  }

  if (!hasDOMException) {
    function DOMException(message, name) {
      var err = new Error(message);
      err.name = name || 'DOMException';
      err.code = 0;
      Object.setPrototypeOf(err, DOMException.prototype);
      return err;
    }
    DOMException.prototype = Object.create(Error.prototype);
    DOMException.prototype.constructor = DOMException;

    global.DOMException = DOMException;
    globalThis.DOMException = DOMException;
  }
})();
