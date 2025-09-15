// Terminal module wrapper
// Loads terminal functionality which is always available

export function getTerminalManager(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const terminalModule = require('./terminal');
  return terminalModule.default;
}
