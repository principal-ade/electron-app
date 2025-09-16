module.exports = function(source) {
  // This loader adds process polyfill for ESM modules that use process globally
  const hasProcess = source.includes('process.') || source.includes('typeof process');
  
  if (hasProcess && !source.includes('import process') && !source.includes('require("process")')) {
    // Prepend process import for ESM modules
    return `import process from '${require.resolve('process/browser.js').replace(/\\/g, '/')}';\n${source}`;
  }
  
  return source;
};