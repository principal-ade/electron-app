// Webpack polyfills for globalThis and other browser globals
module.exports = {
  resolve: {
    fallback: {
      globalThis: false,
    },
    alias: {
      globalThis: require.resolve('./globalThis-polyfill.js'),
    }
  },
  plugins: [
    new (require('webpack').ProvidePlugin)({
      globalThis: require.resolve('./globalThis-polyfill.js'),
    })
  ]
};