/**
 * DevSidecarService - Service layer for dev sidecar window management
 * Provides a centralized service for opening and managing dev sidecar windows
 */

import type {
  CreateDevSidecarWindowPayload,
  DevSidecarWindowInfo,
  DevSidecarServerStatusResponse,
  StartDevSidecarServerPayload,
} from '../../shared/main-process-api-interfaces/DevSidecarAPI';

export class DevSidecarService {
  /**
   * Create a dev sidecar window
   * @param payload - Window configuration
   */
  static async createWindow(
    payload: CreateDevSidecarWindowPayload = {},
  ): Promise<DevSidecarWindowInfo> {
    try {
      return await window.mainProcess.devSidecar.createWindow(payload);
    } catch (error) {
      console.error('[DevSidecarService] Failed to create window:', error);
      throw new Error('Failed to create dev sidecar window');
    }
  }

  /**
   * Destroy a dev sidecar window
   * @param sessionId - Session ID of the window to destroy
   */
  static async destroyWindow(sessionId: string): Promise<{ success: boolean }> {
    try {
      return await window.mainProcess.devSidecar.destroyWindow(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to destroy window:', error);
      return { success: false };
    }
  }

  /**
   * Focus a dev sidecar window
   * @param sessionId - Session ID of the window to focus
   */
  static async focusWindow(sessionId: string): Promise<{ success: boolean }> {
    try {
      return await window.mainProcess.devSidecar.focusWindow(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to focus window:', error);
      return { success: false };
    }
  }

  /**
   * Start a dev server
   * @param payload - Server configuration
   */
  static async startServer(
    payload: StartDevSidecarServerPayload,
  ): Promise<DevSidecarServerStatusResponse> {
    try {
      return await window.mainProcess.devSidecar.startServer(payload);
    } catch (error) {
      console.error('[DevSidecarService] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop a dev server
   * @param sessionId - Session ID of the server to stop
   */
  static async stopServer(sessionId: string): Promise<{ success: boolean }> {
    try {
      return await window.mainProcess.devSidecar.stopServer({ sessionId });
    } catch (error) {
      console.error('[DevSidecarService] Failed to stop server:', error);
      return { success: false };
    }
  }

  /**
   * Restart a dev server
   * @param sessionId - Session ID of the server to restart
   * @param newPort - Optional new port number
   */
  static async restartServer(
    sessionId: string,
    newPort?: number,
  ): Promise<DevSidecarServerStatusResponse> {
    try {
      return await window.mainProcess.devSidecar.restartServer({
        sessionId,
        newPort,
      });
    } catch (error) {
      console.error('[DevSidecarService] Failed to restart server:', error);
      throw error;
    }
  }

  /**
   * Get dev server status
   * @param sessionId - Session ID to get status for
   */
  static async getStatus(
    sessionId: string,
  ): Promise<DevSidecarServerStatusResponse> {
    try {
      return await window.mainProcess.devSidecar.getStatus(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to get status:', error);
      return { sessionId, status: 'idle' };
    }
  }

  /**
   * Reload the dev sidecar window
   * @param sessionId - Session ID of the window to reload
   * @param clearCache - Whether to clear the cache before reloading
   */
  static async reload(sessionId: string, clearCache?: boolean): Promise<void> {
    try {
      await window.mainProcess.devSidecar.reload(sessionId, clearCache);
    } catch (error) {
      console.error('[DevSidecarService] Failed to reload:', error);
    }
  }

  /**
   * Navigate to a path in the dev sidecar window
   * @param sessionId - Session ID of the window
   * @param path - Path to navigate to
   */
  static async navigate(sessionId: string, path: string): Promise<void> {
    try {
      await window.mainProcess.devSidecar.navigate(sessionId, path);
    } catch (error) {
      console.error('[DevSidecarService] Failed to navigate:', error);
    }
  }

  /**
   * Toggle dev tools for the dev sidecar window
   * @param sessionId - Session ID of the window
   */
  static async toggleDevTools(sessionId: string): Promise<void> {
    try {
      await window.mainProcess.devSidecar.toggleDevTools(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to toggle dev tools:', error);
    }
  }

  /**
   * Toggle logs view in the dev sidecar window
   * @param sessionId - Session ID of the window
   */
  static async toggleLogs(sessionId: string): Promise<{ visible: boolean }> {
    try {
      return await window.mainProcess.devSidecar.toggleLogs(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to toggle logs:', error);
      return { visible: false };
    }
  }

  /**
   * Get buffered logs for a session
   * @param sessionId - Session ID to get logs for
   */
  static async getBufferedLogs(sessionId: string): Promise<any[]> {
    try {
      return await window.mainProcess.devSidecar.getBufferedLogs(sessionId);
    } catch (error) {
      console.error('[DevSidecarService] Failed to get buffered logs:', error);
      return [];
    }
  }

  /**
   * Listen for window created events
   */
  static onWindowCreated(
    callback: (info: DevSidecarWindowInfo) => void,
  ): () => void {
    return window.mainProcess.devSidecar.onWindowCreated(callback);
  }

  /**
   * Listen for window closed events
   */
  static onWindowClosed(callback: (sessionId: string) => void): () => void {
    return window.mainProcess.devSidecar.onWindowClosed(callback);
  }

  /**
   * Listen for window focused events
   */
  static onWindowFocused(callback: (sessionId: string) => void): () => void {
    return window.mainProcess.devSidecar.onWindowFocused(callback);
  }

  /**
   * Listen for server started events
   */
  static onServerStarted(
    callback: (payload: DevSidecarServerStatusResponse) => void,
  ): () => void {
    return window.mainProcess.devSidecar.onServerStarted(callback);
  }

  /**
   * Listen for server stopped events
   */
  static onServerStopped(
    callback: (payload: DevSidecarServerStatusResponse) => void,
  ): () => void {
    return window.mainProcess.devSidecar.onServerStopped(callback);
  }

  /**
   * Listen for server error events
   */
  static onServerError(
    callback: (payload: DevSidecarServerStatusResponse) => void,
  ): () => void {
    return window.mainProcess.devSidecar.onServerError(callback);
  }

  /**
   * Listen for server status events
   */
  static onServerStatus(
    callback: (payload: DevSidecarServerStatusResponse) => void,
  ): () => void {
    return window.mainProcess.devSidecar.onServerStatus(callback);
  }
}
