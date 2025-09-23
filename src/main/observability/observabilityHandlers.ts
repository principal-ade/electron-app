/**
 * IPC handlers for observability configuration and management
 */

import { ipcMain } from 'electron';
import { getObservabilityIntegration } from './ObservabilityIntegration';
import type { ObservabilityConfig } from './ObservabilityIntegration';

export function registerObservabilityHandlers(): void {
  const observability = getObservabilityIntegration();

  /**
   * Get current observability configuration
   */
  ipcMain.handle('observability:getConfig', async () => {
    try {
      const config = await observability.getConfiguration();
      return { success: true, config };
    } catch (error) {
      console.error('[ObservabilityHandlers] Failed to get config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get configuration',
      };
    }
  });

  /**
   * Save observability configuration
   */
  ipcMain.handle('observability:saveConfig', async (event, config: ObservabilityConfig) => {
    try {
      await observability.updateConfiguration(config);
      return { success: true };
    } catch (error) {
      console.error('[ObservabilityHandlers] Failed to save config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save configuration',
      };
    }
  });

  /**
   * Test observability connection
   */
  ipcMain.handle('observability:testConnection', async (event, config: ObservabilityConfig) => {
    try {
      const result = await observability.testConnection(config);
      return result;
    } catch (error) {
      console.error('[ObservabilityHandlers] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  });

  /**
   * Get observability status and statistics
   */
  ipcMain.handle('observability:getStatus', async () => {
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

  console.log('[ObservabilityHandlers] Registered IPC handlers');
}