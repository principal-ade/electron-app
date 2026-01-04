/**
 * GitSyncIPC - IPC handlers for git-sync operations
 *
 * Provides IPC endpoints for git-sync operations that renderers can call.
 * Connects to the traffic controller via WebSocket for real-time collaboration.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { GitSyncEvent } from '../../window/main-process-api-implementations/gitSyncApi';
import { PresenceEvent } from '../../window/main-process-api-implementations/presenceApi';
import {
  GitSyncConfig,
  GitSyncConnectionResult,
  GitSyncStatus,
  GitSyncMessage as APIGitSyncMessage,
  GitSyncRoomTokenRequest,
  GitSyncRoomTokenResponse,
} from '../../shared/main-process-api-interfaces/GitSyncAPI';
import {
  gitSyncWebSocketManager,
  GitSyncMessage,
} from './GitSyncWebSocketManager';

class GitSyncIPC {
  constructor() {
    this.setupHandlers();
    console.log('[GitSyncIPC] Initialized');
  }

  private setupHandlers() {
    // Handler for git-sync:connect
    ipcMain.handle(
      GitSyncEvent.CONNECT,
      async (
        event,
        config: GitSyncConfig,
      ): Promise<GitSyncConnectionResult> => {
        console.log('[GitSyncIPC] Connect requested with config:', config);

        // Get the window ID from the event sender
        const window = BrowserWindow.fromWebContents(event.sender);
        const windowId = window?.id ?? -1;

        // Connect via WebSocket manager with window tracking
        return await gitSyncWebSocketManager.connect(config, windowId);
      },
    );

    // Handler for git-sync:disconnect
    ipcMain.handle(
      GitSyncEvent.DISCONNECT,
      async (
        event,
        connectionId: string,
      ): Promise<{ success: boolean; message?: string }> => {
        console.log('[GitSyncIPC] Disconnect requested for:', connectionId);

        return await gitSyncWebSocketManager.disconnect(connectionId);
      },
    );

    // Handler for git-sync:get-status
    ipcMain.handle(
      GitSyncEvent.GET_STATUS,
      async (event, connectionId: string): Promise<GitSyncStatus | null> => {
        console.log('[GitSyncIPC] Status requested for:', connectionId);

        return gitSyncWebSocketManager.getStatus(connectionId);
      },
    );

    // Handler for git-sync:send-message
    ipcMain.handle(
      GitSyncEvent.SEND_MESSAGE,
      async (
        event,
        message: APIGitSyncMessage,
      ): Promise<{ success: boolean; error?: string }> => {
        console.log('[GitSyncIPC] Send message:', message);

        // Cast API GitSyncMessage.data (unknown) to internal GitSyncMessage
        // The internal GitSyncMessage has an index signature allowing this cast
        return await gitSyncWebSocketManager.sendMessageToConnection(
          message.connectionId,
          message.data as Parameters<
            typeof gitSyncWebSocketManager.sendMessageToConnection
          >[1],
        );
      },
    );

    // Handler for git-sync:get-room-token
    ipcMain.handle(
      GitSyncEvent.GET_ROOM_TOKEN,
      async (
        event,
        request: GitSyncRoomTokenRequest,
      ): Promise<GitSyncRoomTokenResponse> => {
        console.log('[GitSyncIPC] Room token requested:', request);

        // TODO: Implement actual room token generation
        return {
          success: false,
          error: 'Room token generation not yet implemented',
        };
      },
    );

    // Handler for git-sync:get-server-url
    ipcMain.handle(GitSyncEvent.GET_SERVER_URL, async (): Promise<string> => {
      const serverUrl = gitSyncWebSocketManager.getServerUrl();
      console.log('[GitSyncIPC] Returning server URL:', serverUrl);
      return serverUrl;
    });

    // Handler for git-sync:set-environment
    ipcMain.handle(
      GitSyncEvent.SET_ENVIRONMENT,
      async (
        event,
        environment: 'development' | 'production',
      ): Promise<void> => {
        console.log('[GitSyncIPC] Setting environment to:', environment);
        gitSyncWebSocketManager.setEnvironment(environment);
      },
    );

    // Handler for git-sync:get-environment
    ipcMain.handle(
      GitSyncEvent.GET_ENVIRONMENT,
      async (): Promise<'development' | 'production'> => {
        const environment = gitSyncWebSocketManager.getCurrentEnvironment();
        console.log('[GitSyncIPC] Returning environment:', environment);
        return environment;
      },
    );

    // Handler for git-sync:check-repo-access
    ipcMain.handle(
      GitSyncEvent.CHECK_REPO_ACCESS,
      async (event, repoUrl: string, token: string): Promise<boolean> => {
        console.log('[GitSyncIPC] Check repo access for:', repoUrl);

        // For now, return true if we have a token
        // TODO: Implement actual repository access check
        return !!token;
      },
    );

    // Handler for git-sync:get-all-connections
    ipcMain.handle(GitSyncEvent.GET_ALL_CONNECTIONS, async () => {
      return gitSyncWebSocketManager.getAllConnections();
    });

    // Handler for presence:connect (connect for presence tracking only)
    ipcMain.handle(
      PresenceEvent.CONNECT,
      async (event, token: string): Promise<GitSyncConnectionResult> => {
        console.log('[GitSyncIPC] Connect to presence requested');

        // Get the window ID from the event sender
        const window = BrowserWindow.fromWebContents(event.sender);
        const windowId = window?.id ?? -1;

        return await gitSyncWebSocketManager.connectToPresence(token, windowId);
      },
    );

    // Handler for presence:disconnect (disconnect from presence-only connection)
    ipcMain.handle(
      PresenceEvent.DISCONNECT,
      async (): Promise<{ success: boolean; message?: string }> => {
        console.log('[GitSyncIPC] Disconnect from presence requested');

        return await gitSyncWebSocketManager.disconnectFromPresence();
      },
    );

    // Handler for git-sync:get-server-presence
    ipcMain.handle(
      GitSyncEvent.GET_SERVER_PRESENCE,
      async (): Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
      }> => {
        console.log('[GitSyncIPC] Fetching server presence');

        try {
          const fetch = (await import('node-fetch')).default;

          // Get the current server URL and convert to HTTP
          const wsUrl = gitSyncWebSocketManager.getServerUrl();
          const httpUrl = wsUrl
            .replace('wss://', 'https://')
            .replace('ws://', 'http://')
            .replace(/\/ws$/, '');

          if (!httpUrl) {
            return { success: false, error: 'No server URL configured' };
          }

          console.log(
            `[GitSyncIPC] Fetching presence from: ${httpUrl}/api/presence/users`,
          );

          const response = await fetch(`${httpUrl}/api/presence/users`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            return {
              success: false,
              error: `Server returned ${response.status}: ${response.statusText}`,
            };
          }

          const data = await response.json();
          return { success: true, data };
        } catch (error) {
          console.error('[GitSyncIPC] Failed to fetch server presence:', error);
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMsg };
        }
      },
    );

    // Handler for git-sync:check-service
    ipcMain.handle(
      GitSyncEvent.CHECK_SERVICE,
      async (
        event,
        url: string,
        serviceName: string,
      ): Promise<{ available: boolean; status?: number; error?: string }> => {
        console.log(`[GitSyncIPC] Checking service: ${serviceName} at ${url}`);

        try {
          // Import fetch dynamically
          const fetch = (await import('node-fetch')).default;

          // Handle different service types
          if (serviceName.includes('Auth Server')) {
            // Check the room-token endpoint for auth servers
            const response = await fetch(`${url}/api/auth/cli/room-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                repository: 'test/test',
                branch: 'main',
                github_token: 'test',
                device_id: 'test',
              }),
              signal: AbortSignal.timeout(5000),
            });

            // 404 means endpoint doesn't exist
            if (response.status === 404) {
              return {
                available: false,
                status: 404,
                error: 'Endpoint not found',
              };
            }

            // Any other response means the endpoint exists
            return { available: true, status: response.status };
          } else if (serviceName === 'GitHub API') {
            // Check GitHub API
            const response = await fetch('https://api.github.com/zen', {
              method: 'GET',
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            });

            return { available: response.ok, status: response.status };
          } else {
            // For WebSocket servers, convert wss:// to https:// for testing
            let testUrl = url;
            if (url.startsWith('wss://')) {
              testUrl = url.replace('wss://', 'https://');
            } else if (url.startsWith('ws://')) {
              testUrl = url.replace('ws://', 'http://');
            }

            // Try to fetch the base URL
            const response = await fetch(testUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            });

            return { available: true, status: response.status };
          }
        } catch (error) {
          console.error(
            `[GitSyncIPC] Service check failed for ${serviceName}:`,
            error,
          );
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return { available: false, error: errorMsg };
        }
      },
    );

    // Handler for git-sync:get-webhook-events
    ipcMain.handle(
      GitSyncEvent.GET_WEBHOOK_EVENTS,
      async (
        event,
        limit?: number,
      ): Promise<{
        success: boolean;
        events: unknown[];
        meta?: unknown;
        error?: string;
      }> => {
        console.log('[GitSyncIPC] Fetching webhook events, limit:', limit);

        try {
          const fetch = (await import('node-fetch')).default;

          // Get the current server URL and convert to HTTP
          const wsUrl = gitSyncWebSocketManager.getServerUrl();
          const httpUrl = wsUrl
            .replace('wss://', 'https://')
            .replace('ws://', 'http://')
            .replace(/\/ws$/, '');

          if (!httpUrl) {
            return { success: false, events: [], error: 'No server URL configured' };
          }

          const queryParams = limit ? `?limit=${limit}` : '';
          console.log(
            `[GitSyncIPC] Fetching events from: ${httpUrl}/api/webhooks/events${queryParams}`,
          );

          const response = await fetch(`${httpUrl}/api/webhooks/events${queryParams}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            return {
              success: false,
              events: [],
              error: `Server returned ${response.status}: ${response.statusText}`,
            };
          }

          const data = await response.json() as {
            success: boolean;
            events: unknown[];
            meta?: unknown;
            error?: string;
          };
          return {
            success: true,
            events: data.events || [],
            meta: data.meta,
          };
        } catch (error) {
          console.error('[GitSyncIPC] Failed to fetch webhook events:', error);
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return { success: false, events: [], error: errorMsg };
        }
      },
    );

    // Handler for git-sync:send-test-webhook-event
    // Injects a mock webhook event locally to test the IPC → renderer flow
    ipcMain.handle(
      GitSyncEvent.SEND_TEST_WEBHOOK_EVENT,
      async (): Promise<{ success: boolean; eventId?: string; error?: string }> => {
        try {
          const testEventId = `local_test_${Date.now()}`;

          // Inject mock event directly to renderers (bypasses server)
          const allWindows = BrowserWindow.getAllWindows();
          const mockEvent = {
            type: 'webhook:github_event',
            payload: {
              eventId: testEventId,
              event: 'test',
              deliveryId: `test-delivery-${Date.now()}`,
              repository: 'test/local-mock',
              branch: 'main',
              processed: true,
              message: 'Local mock event (tests IPC flow only)',
              timestamp: Date.now(),
              backlogChanges: [],
            },
          };

          allWindows.forEach((window) => {
            if (window.webContents && !window.webContents.isDestroyed()) {
              window.webContents.send(
                GitSyncEvent.ON_MESSAGE,
                '__presence_only__',
                mockEvent,
              );
            }
          });

          console.log('[GitSyncIPC] Injected local test webhook event:', testEventId);
          return { success: true, eventId: testEventId };
        } catch (error) {
          console.error('[GitSyncIPC] Failed to send test webhook event:', error);
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          return { success: false, error: errorMsg };
        }
      },
    );
  }

  /**
   * Utility function to emit git-sync messages to all renderer processes
   */
  public emitMessage(connectionKey: string, message: GitSyncMessage) {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      if (window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send(
          GitSyncEvent.ON_MESSAGE,
          connectionKey,
          message,
        );
      }
    });
  }
}

// Create and export singleton instance
export const gitSyncIPC = new GitSyncIPC();
