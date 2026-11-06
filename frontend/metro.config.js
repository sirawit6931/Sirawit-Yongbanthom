const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prefer react-native bundles over browser/node bundles.
// firebase/auth/package.json is patched to add "react-native" field pointing
// to @firebase/auth/dist/rn/index.js which runs registerAuth("ReactNative").
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Make sure Metro can resolve .cjs/.mjs entry points.
// Firebase v12 ships several bundles under "exports" as .mjs/.cjs; without
// these in sourceExts Metro will only pick up .js and can accidentally pull a
// Web bundle that wasn't built for Hermes.
if (config.resolver.sourceExts) {
  for (const ext of ['cjs', 'mjs']) {
    if (!config.resolver.sourceExts.includes(ext)) {
      config.resolver.sourceExts.push(ext);
    }
  }
}

// Inject polyfills before any module runs (DOMException for Hermes/JSC)
const originalGetPolyfills = config.serializer.getPolyfills
  ? config.serializer.getPolyfills.bind(config.serializer)
  : () => [];

config.serializer.getPolyfills = (ctx) => [
  path.resolve(__dirname, 'polyfills.js'),
  ...originalGetPolyfills(ctx),
];

module.exports = config;
