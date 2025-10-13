/**
 * IPC handlers for observability configuration and management
 */

import { ipcMain, app } from 'electron';
import * as path from 'path';
import { getObservabilityIntegration } from './ObservabilityIntegration';
import type { ObservabilityConfig } from './ObservabilityIntegration';
import { ObservabilityEvent } from '../../shared/ipc-events/ObservabilityEvents';

export function registerObservabilityHandlers(): void {
  const observability = getObservabilityIntegration();

  /**
   * Get current observability configuration
   */
  ipcMain.handle(ObservabilityEvent.GET_CONFIG, async () => {
    try {
      const config = await observability.getConfiguration();
      return { success: true, config };
    } catch (error) {
      console.error('[ObservabilityHandlers] Failed to get config:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get configuration',
      };
    }
  });

  /**
   * Save observability configuration
   */
  ipcMain.handle(
    ObservabilityEvent.SAVE_CONFIG,
    async (event, config: ObservabilityConfig) => {
      try {
        await observability.updateConfiguration(config);
        return { success: true };
      } catch (error) {
        console.error('[ObservabilityHandlers] Failed to save config:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to save configuration',
        };
      }
    },
  );

  /**
   * Test observability connection
   */
  ipcMain.handle(
    ObservabilityEvent.TEST_CONNECTION,
    async (event, config: ObservabilityConfig) => {
      try {
        const result = await observability.testConnection(config);
        return result;
      } catch (error) {
        console.error('[ObservabilityHandlers] Connection test failed:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Connection test failed',
        };
      }
    },
  );

  /**
   * Get observability status and statistics
   */
  ipcMain.handle(ObservabilityEvent.GET_STATUS, async () => {
    try {
      const stats = observability.getStats();
      const config = await observability.getConfiguration();
      return {
        success: true,
        status: {
          ...stats,
          enabled: config.enabled !== false,
          hasConfig: !!config.tursoUrl,
        },
      };
    } catch (error) {
      console.error('[ObservabilityHandlers] Failed to get status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      };
    }
  });

  /**
   * Resolve database path to absolute path
   */
  ipcMain.handle(ObservabilityEvent.RESOLVE_PATH, async (event, dbPath: string) => {
    try {
      if (!dbPath) {
        dbPath = 'observability.db';
      }

      // If it's already an absolute path, return it
      if (path.isAbsolute(dbPath)) {
        return { success: true, resolvedPath: dbPath };
      }

      // For relative paths, resolve from userData directory
      const userDataPath = app.getPath('userData');
      const resolvedPath = path.resolve(userDataPath, dbPath);

      return { success: true, resolvedPath };
    } catch (error) {
      console.error('[ObservabilityHandlers] Failed to resolve path:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve path',
      };
    }
  });

  console.log('[ObservabilityHandlers] Registered IPC handlers');
}
