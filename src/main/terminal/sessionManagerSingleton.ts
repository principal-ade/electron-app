/**
 * Singleton Session Manager
 *
 * Provides a single shared instance of TerminalSessionManager
 * for use by both TIPC router and legacy handlers.
 */

import { TerminalSessionManager, initializeDaemonModeSetting } from './TerminalSessionManager';

let instance: TerminalSessionManager | null = null;
let daemonModeInitialized = false;

/**
 * Initialize daemon mode setting from user preferences.
 * Should be called early in app startup, after UserPreferencesHandler is initialized.
 */
export async function initializeTerminalSettings(): Promise<void> {
  if (!daemonModeInitialized) {
    await initializeDaemonModeSetting();
    daemonModeInitialized = true;
  }
}

export function getSessionManagerInstance(): TerminalSessionManager {
  if (!instance) {
    instance = new TerminalSessionManager();
  }
  return instance;
}

export function destroySessionManagerInstance(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
