module.exports = function (api) {
  // Cache the configuration based on the NODE_ENV
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

  if (isTest) {
    // Jest-compatible preset — uses plain @babel/preset-env instead of babel-preset-expo
    return {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    };
  }

  // Default Expo preset for the app
  // NOTE: babel-preset-expo already includes class-properties, private-methods,
  // and private-property-in-object with consistent loose mode — no need to
  // re-declare them here (doing so causes a Babel loose mode conflict warning).
  return {
    presets: ['babel-preset-expo'],
  };
};
