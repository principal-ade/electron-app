/**
 * Singleton Session Manager
 *
 * Provides a single shared instance of TerminalSessionManager
 * for use by both TIPC router and legacy handlers.
 */

import { TerminalSessionManager } from './TerminalSessionManager';

let instance: TerminalSessionManager | null = null;

export function getSessionManagerInstance(): TerminalSessionManager {
  if (!instance) {
    instance = new TerminalSessionManager();
  }
  return instance;
}

export function destroySessionManagerInstance(): void {
  if (instance) {
    instance.destroyAllSessions();
    instance = null;
  }
}
