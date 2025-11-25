// Terminal module wrapper
// Loads terminal functionality which is always available

import type { TerminalManager } from './terminal/index';

export function getTerminalManager(): TerminalManager | null {
  const terminalModule = require('./terminal/index');
  return terminalModule.default;
}
