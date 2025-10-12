// Terminal module wrapper
// Loads terminal functionality which is always available

import type { TerminalManager } from './terminal';

export function getTerminalManager(): TerminalManager | null {
  const terminalModule = require('./terminal');
  return terminalModule.default;
}
