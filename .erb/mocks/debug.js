// Mock debug module for preload context
// The real debug module uses process and other Node.js APIs not available in preload

function createDebug(namespace) {
  const noop = () => {};
  noop.enabled = false;
  noop.color = '';
  noop.diff = 0;
  noop.log = noop;
  noop.namespace = namespace;
  noop.destroy = noop;
  noop.extend = createDebug;
  return noop;
}

createDebug.enable = () => {};
createDebug.disable = () => {};
createDebug.enabled = () => false;
createDebug.humanize = (ms) => ms + 'ms';
createDebug.names = [];
createDebug.skips = [];
createDebug.formatters = {};

module.exports = createDebug;