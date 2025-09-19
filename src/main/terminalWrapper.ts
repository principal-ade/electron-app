// Terminal module wrapper
// Loads terminal functionality which is always available

export function getTerminalManager(): any {
  const terminalModule = require('./terminal');
  return terminalModule.default;
}
