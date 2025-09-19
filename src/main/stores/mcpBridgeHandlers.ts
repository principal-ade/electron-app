import { ipcMain } from 'electron';
import { mcpBridgeDataStore } from './MCPBridgeDataStore';

/**
 * Register IPC handlers for MCP Bridge data access
 */
export function registerMCPBridgeHandlers(): void {
  // Get statistics for repository
  ipcMain.handle(
    'mcp-bridge:get-stats',
    async (_event, repositoryUrl: string) => {
      try {
        const stats =
          await mcpBridgeDataStore.getStatisticsForRepository(repositoryUrl);
        if (!stats) {
          return {
            success: true,
            data: {
              totalRequests: 0,
              successfulRequests: 0,
              failedRequests: 0,
              averageResponseTime: 0,
              endpointUsage: {},
              lastAccessTime: null,
            },
          };
        }

        // Convert Map to object for serialization
        const endpointUsageObj = Object.fromEntries(stats.endpointUsage);

        return {
          success: true,
          data: {
            ...stats,
            endpointUsage: endpointUsageObj,
          },
        };
      } catch (error) {
        console.error('[MCPBridgeHandlers] Error getting stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get recent interactions for repository
  ipcMain.handle(
    'mcp-bridge:get-interactions',
    async (_event, repositoryUrl: string, options?: any) => {
      try {
        const interactions =
          await mcpBridgeDataStore.getInteractionsForRepository(
            repositoryUrl,
            options,
          );

        return {
          success: true,
          data: interactions,
        };
      } catch (error) {
        console.error('[MCPBridgeHandlers] Error getting interactions:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Export test data
  ipcMain.handle(
    'mcp-bridge:export-tests',
    async (
      _event,
      repositoryUrl: string,
      format: 'json' | 'jest' | 'mocha' = 'json',
    ) => {
      try {
        const testData = await mcpBridgeDataStore.exportForTesting(
          repositoryUrl,
          format,
        );

        return {
          success: true,
          data: testData,
        };
      } catch (error) {
        console.error('[MCPBridgeHandlers] Error exporting tests:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get summary across all repositories
  ipcMain.handle('mcp-bridge:get-summary', async () => {
    try {
      const summary = await mcpBridgeDataStore.getSummary();

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('[MCPBridgeHandlers] Error getting summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Clear data for a repository
  ipcMain.handle(
    'mcp-bridge:clear-data',
    async (_event, repositoryUrl: string) => {
      try {
        await mcpBridgeDataStore.clearRepositoryData(repositoryUrl);

        return {
          success: true,
        };
      } catch (error) {
        console.error('[MCPBridgeHandlers] Error clearing data:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  console.log('[MCPBridgeHandlers] IPC handlers registered');
}
