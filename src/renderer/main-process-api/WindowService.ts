/**
 * WindowService - Service layer for window management operations
 *
 * This service encapsulates all window.mainProcess.window calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.window MUST be made through this service.
 */

import type {
  RepositoryWindowState,
  DevWorkspaceOptions,
  ExtensionWindowOptions,
  TabTransferData,
  OpenTerminalTabPayload,
  OpenRepositoryExplorerPayload,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type {
  DetachableTabDescriptor,
  DetachedTabIncomingPayload,
  DetachedTabOpenResult,
  DetachedTabReturnResult,
} from '../../shared/detachedTab';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

// Re-export for convenience
export type {
  RepositoryWindowState,
  TabTransferData,
  OpenTerminalTabPayload,
  DetachableTabDescriptor,
  DetachedTabIncomingPayload,
  DetachedTabOpenResult,
  DetachedTabReturnResult,
};

/**
 * Service for managing application windows
 */
export class WindowService {
  /**
   * Get the current window's ID
   * @returns The Electron BrowserWindow ID
   */
  static async getWindowId(): Promise<number> {
    return window.mainProcess.window.getWindowId();
  }

  /**
   * Focus the main window if it exists, otherwise create it
   * @returns True if successful, false if failed
   */
  static async focusOrCreateMainWindow(): Promise<boolean> {
    try {
      return await window.mainProcess.window.focusOrCreateMainWindow();
    } catch (error) {
      console.error(
        '[WindowService] Failed to focus/create main window:',
        error,
      );
      return false;
    }
  }

  /**
   * Focus the main window and navigate to updates settings
   * @returns True if successful, false if failed
   */
  static async navigateToUpdates(): Promise<boolean> {
    try {
      return await window.mainProcess.window.navigateToUpdates();
    } catch (error) {
      console.error('[WindowService] Failed to navigate to updates:', error);
      return false;
    }
  }

  /**
   * Listen for navigate to updates events (used by main window)
   * @param callback - Called when navigation to updates is requested
   * @returns Unsubscribe function
   */
  static onNavigateToUpdates(callback: () => void): () => void {
    try {
      return window.mainProcess.window.onNavigateToUpdates(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register navigate to updates listener:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Listen for open-terminal-tab events (Quick Open with terminal target).
   * The principal window should open a terminal tab at the given directory.
   * @param callback - Called with directory + optional label
   * @returns Unsubscribe function
   */
  static onOpenTerminalTab(
    callback: (payload: OpenTerminalTabPayload) => void,
  ): () => void {
    try {
      return window.mainProcess.window.onOpenTerminalTab(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register open-terminal-tab listener:',
        error,
      );
      return () => {};
    }
  }

  static onOpenRepositoryExplorer(
    callback: (payload: OpenRepositoryExplorerPayload) => void,
  ): () => void {
    try {
      return window.mainProcess.window.onOpenRepositoryExplorer(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register repository explorer listener:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Focus a window by its ID
   * @param windowId - The Electron BrowserWindow ID to focus
   * @returns True if the window was found and focused, false otherwise
   */
  static async focusWindowById(windowId: number): Promise<boolean> {
    try {
      return await window.mainProcess.window.focusWindowById(windowId);
    } catch (error) {
      console.error('[WindowService] Failed to focus window:', error);
      return false;
    }
  }

  /**
   * Check if a repository window is already open
   * @param repository - Alexandria repository entry to check
   * @returns True if the repository window is open, false otherwise
   */
  static async isRepositoryWindowOpen(
    repository: AlexandriaEntry,
  ): Promise<boolean> {
    try {
      return await window.mainProcess.window.isRepositoryWindowOpen(repository);
    } catch (error) {
      console.error(
        '[WindowService] Failed to check repository window status:',
        error,
      );
      return false;
    }
  }

  /**
   * Get the currently open repository / dev-workspace windows
   * @returns One entry per live repository window (empty array on failure)
   */
  static async getOpenRepositoryWindows(): Promise<RepositoryWindowState[]> {
    try {
      return await window.mainProcess.window.getOpenRepositoryWindows();
    } catch (error) {
      console.error(
        '[WindowService] Failed to get open repository windows:',
        error,
      );
      return [];
    }
  }

  /**
   * Listen for repository windows state changes
   * @param callback - Called with array of repository window states when state changes
   * @returns Unsubscribe function
   */
  static onRepositoryWindowsChanged(
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ): () => void {
    try {
      return window.mainProcess.window.onRepositoryWindowsChanged(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register repository windows listener:',
        error,
      );
      return () => {};
    }
  }

  /**
   * Open a dev workspace window with the panel framework
   * @param options - Options containing the Alexandria entry for the repository
   * @returns Window ID if successful, null otherwise
   */
  static async openDevWorkspace(
    options: DevWorkspaceOptions,
  ): Promise<{ windowId: number } | null> {
    try {
      return await window.mainProcess.window.openDevWorkspace(options);
    } catch (error) {
      console.error('[WindowService] Failed to open dev workspace:', error);
      throw new Error('Failed to open dev workspace window');
    }
  }

  /**
   * Open the extension browser window
   * @param options - Optional configuration
   * @returns Window ID if successful, null otherwise
   */
  static async openExtensionWindow(
    options?: ExtensionWindowOptions,
  ): Promise<{ windowId: number } | null> {
    try {
      return await window.mainProcess.window.openExtensionWindow(options);
    } catch (error) {
      console.error('[WindowService] Failed to open extension window:', error);
      throw new Error('Failed to open extension window');
    }
  }

  /**
   * Send a tab to another window.
   * @param data - The tab transfer payload
   */
  static async sendTabToWindow(data: TabTransferData): Promise<void> {
    try {
      await window.mainProcess.window.sendTabToWindow(data);
    } catch (error) {
      console.error('[WindowService] Failed to send tab to window:', error);
    }
  }

  /**
   * Listen for tab-received events (another window sent a tab here).
   * @param callback - Called with the tab transfer data
   * @returns Unsubscribe function
   */
  static onTabReceived(callback: (data: TabTransferData) => void): () => void {
    try {
      return window.mainProcess.window.onTabReceived(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register tab-received listener:',
        error,
      );
      return () => {};
    }
  }

  // -------------------------------------------------------------------------
  // Detached workspace tabs
  // -------------------------------------------------------------------------

  /**
   * Ask main to move `tab` into a standalone window. Resolves once the
   * destination accepts (transferred = true), or after a failure/timeout in
   * which case the caller keeps the source tab.
   */
  static async openDetachedTab(
    tab: DetachableTabDescriptor,
  ): Promise<DetachedTabOpenResult> {
    try {
      return await window.mainProcess.window.openDetachedTab(tab);
    } catch (error) {
      console.error('[WindowService] Failed to open detached tab:', error);
      return { ok: false, transferred: false, reason: 'ipc-failed' };
    }
  }

  /** Destination window: claim the transfer token from the URL hash. */
  static async claimDetachedTab(
    token: string,
  ): Promise<DetachableTabDescriptor | null> {
    try {
      return await window.mainProcess.window.claimDetachedTab(token);
    } catch (error) {
      console.error('[WindowService] Failed to claim detached tab:', error);
      return null;
    }
  }

  /** Destination window: report that the tab rendered successfully. */
  static async acceptDetachedTab(token: string): Promise<boolean> {
    try {
      return await window.mainProcess.window.acceptDetachedTab(token);
    } catch (error) {
      console.error('[WindowService] Failed to accept detached tab:', error);
      return false;
    }
  }

  /** Destination window: report that the tab could not render. */
  static async rejectDetachedTab(
    token: string,
    reason?: string,
  ): Promise<void> {
    try {
      await window.mainProcess.window.rejectDetachedTab(token, reason);
    } catch (error) {
      console.error('[WindowService] Failed to reject detached tab:', error);
    }
  }

  /** Detached window: hand the current tab back to the main window. */
  static async returnDetachedTabToMain(
    tab: DetachableTabDescriptor,
  ): Promise<DetachedTabReturnResult> {
    try {
      return await window.mainProcess.window.returnDetachedTabToMain(tab);
    } catch (error) {
      console.error('[WindowService] Failed to return detached tab:', error);
      return { ok: false, reason: 'ipc-failed' };
    }
  }

  /** Main window: subscribe to pending return transfers. */
  static onIncomingDetachedTab(
    callback: (payload: DetachedTabIncomingPayload) => void,
  ): () => void {
    try {
      return window.mainProcess.window.onIncomingDetachedTab(callback);
    } catch (error) {
      console.error(
        '[WindowService] Failed to register detached-tab listener:',
        error,
      );
      return () => {};
    }
  }

  /** Main window: claim a pending return transfer by token. */
  static async claimIncomingDetachedTab(
    token: string,
  ): Promise<DetachableTabDescriptor | null> {
    try {
      return await window.mainProcess.window.claimIncomingDetachedTab(token);
    } catch (error) {
      console.error(
        '[WindowService] Failed to claim incoming detached tab:',
        error,
      );
      return null;
    }
  }

  /** Main window: the tab is open; main may close the detached window. */
  static async acceptIncomingDetachedTab(token: string): Promise<boolean> {
    try {
      return await window.mainProcess.window.acceptIncomingDetachedTab(token);
    } catch (error) {
      console.error(
        '[WindowService] Failed to accept incoming detached tab:',
        error,
      );
      return false;
    }
  }

  /** Main window: adoption failed; the detached window stays open. */
  static async rejectIncomingDetachedTab(
    token: string,
    reason?: string,
  ): Promise<void> {
    try {
      await window.mainProcess.window.rejectIncomingDetachedTab(token, reason);
    } catch (error) {
      console.error(
        '[WindowService] Failed to reject incoming detached tab:',
        error,
      );
    }
  }
}
