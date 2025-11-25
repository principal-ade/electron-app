import { BrowserWindow } from 'electron';
import { TerminalSessionManager } from './TerminalSessionManager';
import { TerminalOwnershipManager } from './TerminalOwnershipManager';
import { TerminalWindowManager } from './TerminalWindowManager';
import { setupSessionHandlers } from './handlers/sessionHandlers';
import { setupOwnershipHandlers } from './handlers/ownershipHandlers';
import { setupCommandHandlers } from './handlers/commandHandlers';
import { setupWindowHandlers } from './handlers/windowHandlers';
import { isPtyAvailable } from './utils/ptyLoader';

/**
 * Main TerminalManager class that coordinates between session management,
 * ownership tracking, and window management.
 */
class TerminalManager {
  private sessionManager: TerminalSessionManager;
  private ownershipManager: TerminalOwnershipManager;
  private windowManager: TerminalWindowManager;

  constructor() {
    this.sessionManager = new TerminalSessionManager();
    this.ownershipManager = new TerminalOwnershipManager();
    this.windowManager = new TerminalWindowManager(
      this.sessionManager.broadcastToRendererWindows.bind(this.sessionManager),
    );

    this.setupIPCHandlers();
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
    setupSessionHandlers(this.sessionManager, this.ownershipManager);
    setupOwnershipHandlers(this.sessionManager, this.ownershipManager);
    setupCommandHandlers(this.sessionManager);
    setupWindowHandlers(this.sessionManager, this.windowManager);
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
   * Clean up all sessions and windows
   */
  destroyAllSessions(): void {
    this.sessionManager.destroyAllSessions();
    this.windowManager.closeAllWindows();
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
