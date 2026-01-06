import { BrowserWindow } from 'electron';
import { getSessionManagerInstance } from './sessionManagerSingleton';
import { setupSessionHandlers } from './handlers/sessionHandlers';
import { setupOwnershipHandlers } from './handlers/ownershipHandlers';
import { setupCommandHandlers } from './handlers/commandHandlers';
import { isPtyAvailable } from './utils/ptyLoader';
import { initializeTerminalBridge } from './bridgeInitializer';
import type { TerminalSessionManager } from './TerminalSessionManager';

/**
 * Main TerminalManager class that coordinates terminal session management.
 * Uses the singleton session manager to share state with TIPC router.
 * Ownership is handled by the singleton ownershipManager.
 */
class TerminalManager {
  private sessionManager: TerminalSessionManager;

  constructor() {
    // Use singleton to share state with TIPC router
    this.sessionManager = getSessionManagerInstance();
    this.setupIPCHandlers();

    // Initialize WebSocket bridge for remote terminal access
    initializeTerminalBridge().catch((error) => {
      console.error('[Terminal] Failed to initialize WebSocket bridge:', error);
    });
  }

  /**
   * Register a renderer window to receive terminal broadcasts
   */
  setMainWindow(window: BrowserWindow): void {
    if (!window) {
      return;
    }

    this.sessionManager.addRendererWindow(window);
  }

  /**
   * Set up all IPC handlers for terminal functionality
   */
  private setupIPCHandlers(): void {
    setupSessionHandlers(this.sessionManager);
    setupOwnershipHandlers(this.sessionManager);
    setupCommandHandlers(this.sessionManager);
  }

  /**
   * Create a terminal with a specific command (used internally by other services)
   */
  async createTerminalWithCommand(
    directory: string,
    command: string,
  ): Promise<string | null> {
    try {
      // Check if we've reached the session limit
      if (!this.sessionManager.canCreateSession()) {
        throw new Error(
          `Maximum number of terminal sessions (${this.sessionManager.getMaxSessions()}) reached. Please close some terminals before opening new ones.`,
        );
      }

      console.log(
        `[Terminal] Creating terminal in directory: ${directory} with command: ${command}`,
      );

      // Create new session with command
      const sessionId = await this.sessionManager.createSession(
        directory,
        undefined,
        command,
      );

      console.log(
        `Terminal session created successfully with command: ${sessionId}`,
      );
      return sessionId;
    } catch (error) {
      console.error('Failed to create terminal with command:', error);
      return null;
    }
  }

  /**
   * Clean up all sessions (keeps worker running)
   */
  destroyAllSessions(): void {
    this.sessionManager.destroyAllSessions();
  }

  /**
   * Shutdown terminal system completely (called on app quit)
   */
  shutdown(): void {
    this.sessionManager.shutdown();
  }
}

// Export singleton instance only if pty is available
let terminalManager: TerminalManager | null = null;
if (isPtyAvailable()) {
  terminalManager = new TerminalManager();
} else {
  console.warn('Terminal functionality disabled - node-pty not available');
}

export default terminalManager;
export { terminalManager };
export type { TerminalManager };
