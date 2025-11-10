/**
 * PresenceWindowBridge - Bridges window lifecycle events to presence reporting
 *
 * Listens for repository window open/close/focus events and automatically
 * reports them to the presence system.
 */

import { BrowserWindow } from 'electron';
import { gitSyncWebSocketManager } from './GitSyncWebSocketManager';

export class PresenceWindowBridge {
  private static instance: PresenceWindowBridge;
  private trackedWindows: Map<string, { owner: string; repo: string; branch: string; localPath?: string }> = new Map();
  private focusedWindow: string | null = null;

  private constructor() {
    console.log('[PresenceWindowBridge] Initialized');
  }

  static getInstance(): PresenceWindowBridge {
    if (!PresenceWindowBridge.instance) {
      PresenceWindowBridge.instance = new PresenceWindowBridge();
    }
    return PresenceWindowBridge.instance;
  }

  /**
   * Track a repository window opening
   * Call this when a repository window is created
   */
  async trackRepositoryOpened(
    windowId: string,
    owner: string,
    repo: string,
    branch: string,
    localPath?: string,
  ): Promise<void> {
    console.log('[PresenceWindowBridge] Tracking repository opened:', {
      windowId,
      owner,
      repo,
      branch,
      localPath,
    });

    // Store the window info
    this.trackedWindows.set(windowId, { owner, repo, branch, localPath });

    // Report to presence system
    try {
      const result = await gitSyncWebSocketManager.reportRepositoryOpened(
        owner,
        repo,
        branch,
        localPath,
      );

      if (!result.success) {
        console.warn('[PresenceWindowBridge] Failed to report repository opened:', result.message);
      }
    } catch (error) {
      console.error('[PresenceWindowBridge] Error reporting repository opened:', error);
    }
  }

  /**
   * Track a repository window closing
   * Call this when a repository window is being destroyed
   */
  async trackRepositoryClosed(windowId: string): Promise<void> {
    const windowInfo = this.trackedWindows.get(windowId);

    if (!windowInfo) {
      console.warn('[PresenceWindowBridge] Attempted to close untracked window:', windowId);
      return;
    }

    console.log('[PresenceWindowBridge] Tracking repository closed:', {
      windowId,
      owner: windowInfo.owner,
      repo: windowInfo.repo,
    });

    // Report to presence system
    try {
      const result = await gitSyncWebSocketManager.reportRepositoryClosed(
        windowInfo.owner,
        windowInfo.repo,
      );

      if (!result.success) {
        console.warn('[PresenceWindowBridge] Failed to report repository closed:', result.message);
      }
    } catch (error) {
      console.error('[PresenceWindowBridge] Error reporting repository closed:', error);
    }

    // Remove from tracking
    this.trackedWindows.delete(windowId);

    // Clear focused window if it was this one
    if (this.focusedWindow === windowId) {
      this.focusedWindow = null;
    }
  }

  /**
   * Track a repository window being focused
   * Call this when a repository window gains focus
   */
  async trackRepositoryFocused(windowId: string): Promise<void> {
    const windowInfo = this.trackedWindows.get(windowId);

    if (!windowInfo) {
      console.warn('[PresenceWindowBridge] Attempted to focus untracked window:', windowId);
      return;
    }

    // Don't report if already focused
    if (this.focusedWindow === windowId) {
      return;
    }

    console.log('[PresenceWindowBridge] Tracking repository focused:', {
      windowId,
      owner: windowInfo.owner,
      repo: windowInfo.repo,
    });

    this.focusedWindow = windowId;

    // Report to presence system
    try {
      const result = await gitSyncWebSocketManager.reportActiveRepository(
        windowInfo.owner,
        windowInfo.repo,
      );

      if (!result.success) {
        console.warn('[PresenceWindowBridge] Failed to report active repository:', result.message);
      }
    } catch (error) {
      console.error('[PresenceWindowBridge] Error reporting active repository:', error);
    }
  }

  /**
   * Setup focus tracking for a window
   * Attaches focus/blur event listeners to a BrowserWindow
   */
  setupWindowFocusTracking(window: BrowserWindow, windowId: string): void {
    window.on('focus', () => {
      this.trackRepositoryFocused(windowId);
    });

    window.on('blur', () => {
      // Could track blur events if needed
      // For now, we only care about focus (active repository)
    });
  }

  /**
   * Get all tracked windows
   */
  getTrackedWindows(): Map<string, { owner: string; repo: string; branch: string; localPath?: string }> {
    return new Map(this.trackedWindows);
  }

  /**
   * Get the currently focused window ID
   */
  getFocusedWindow(): string | null {
    return this.focusedWindow;
  }
}

// Export singleton instance
export const presenceWindowBridge = PresenceWindowBridge.getInstance();
