import { ipcMain } from 'electron';
import { OptimizedDockerService } from '../../../docker/OptimizedDockerService';
import { DockerStoreService } from '../../../docker/DockerStoreService';

/**
 * IPC handlers for the optimized Docker service with container reuse
 */
export function registerOptimizedDockerHandlers() {
  // Run analysis with container reuse
  ipcMain.handle(
    'docker:run-analysis',
    async (
      event,
      params: {
        toolName: string;
        projectPath: string;
        repositoryUrl?: string;
        options?: {
          reporter?: string;
          config?: string;
          fix?: boolean;
        };
      },
    ) => {
      try {
        const dockerService = await OptimizedDockerService.getInstance();
        await dockerService.initialize();

        const session = await dockerService.runAnalysis(
          params.toolName,
          params.projectPath,
          params.options,
        );

        // Update session with repository URL if provided
        if (params.repositoryUrl) {
          session.repositoryUrl = params.repositoryUrl;
          const storeService = await DockerStoreService.getInstance();
          await storeService.saveSession(session);
        }

        return {
          success: true,
          session,
          // Return results in format expected by existing code
          data: session.results,
        };
      } catch (error) {
        console.error('Error running Docker analysis:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get container status and statistics
  ipcMain.handle('docker:get-container-status', async () => {
    try {
      const dockerService = await OptimizedDockerService.getInstance();
      const storeService = await DockerStoreService.getInstance();

      const activeContainers = await dockerService.getActiveContainers();
      const storageUsage = await storeService.getStorageUsage();

      return {
        success: true,
        data: {
          activeContainers: activeContainers.map((container) => ({
            id: container.id,
            toolName: container.toolName,
            status: container.status,
            created: container.created,
            lastUsed: container.lastUsed,
            metrics: container.metrics,
            currentSession: container.currentSession,
          })),
          storageUsage,
        },
      };
    } catch (error) {
      console.error('Error getting container status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get analysis session history
  ipcMain.handle(
    'docker:get-session-history',
    async (
      event,
      params: {
        toolName?: string;
        repositoryUrl?: string;
        limit?: number;
      },
    ) => {
      try {
        const storeService = await DockerStoreService.getInstance();

        let sessions;
        if (params.toolName) {
          sessions = await storeService.getSessionsByTool(
            params.toolName,
            params.limit,
          );
        } else if (params.repositoryUrl) {
          sessions = await storeService.getSessionsByRepository(
            params.repositoryUrl,
            params.limit,
          );
        } else {
          sessions = await storeService.getRecentSessions(params.limit || 50);
        }

        return {
          success: true,
          data: sessions,
        };
      } catch (error) {
        console.error('Error getting session history:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get tool statistics
  ipcMain.handle(
    'docker:get-tool-statistics',
    async (event, toolName: string) => {
      try {
        const storeService = await DockerStoreService.getInstance();
        const statistics = await storeService.getToolStatistics(toolName);

        return {
          success: true,
          data: statistics,
        };
      } catch (error) {
        console.error('Error getting tool statistics:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get repository analysis statistics
  ipcMain.handle(
    'docker:get-repository-statistics',
    async (event, repositoryUrl: string) => {
      try {
        const storeService = await DockerStoreService.getInstance();
        const statistics =
          await storeService.getRepositoryStatistics(repositoryUrl);

        return {
          success: true,
          data: statistics,
        };
      } catch (error) {
        console.error('Error getting repository statistics:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Stop all containers
  ipcMain.handle('docker:stop-all-containers', async () => {
    try {
      const dockerService = await OptimizedDockerService.getInstance();
      await dockerService.stopAllContainers();

      return { success: true };
    } catch (error) {
      console.error('Error stopping containers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Cleanup old sessions and containers
  ipcMain.handle(
    'docker:cleanup',
    async (
      event,
      params: {
        olderThanDays?: number;
        removeStaleContainers?: boolean;
      },
    ) => {
      try {
        const dockerService = await OptimizedDockerService.getInstance();
        const storeService = await DockerStoreService.getInstance();

        const results = {
          sessionsDeleted: 0,
          containersRemoved: 0,
        };

        if (params.olderThanDays) {
          results.sessionsDeleted = await storeService.cleanupOldSessions(
            params.olderThanDays,
          );
        }

        if (params.removeStaleContainers) {
          await dockerService.cleanupStoppedContainers();
          results.containersRemoved =
            await storeService.removeStaleContainers();
        }

        return {
          success: true,
          data: results,
        };
      } catch (error) {
        console.error('Error during cleanup:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get session details
  ipcMain.handle('docker:get-session', async (event, sessionId: string) => {
    try {
      const storeService = await DockerStoreService.getInstance();
      const session = await storeService.getSession(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Health check - verify all containers are responsive
  ipcMain.handle('docker:health-check', async () => {
    try {
      const dockerService = await OptimizedDockerService.getInstance();
      const storeService = await DockerStoreService.getInstance();

      const containers = await dockerService.getActiveContainers();
      const healthStatus = {
        totalContainers: containers.length,
        healthyContainers: 0,
        unhealthyContainers: 0,
        details: [] as any[],
      };

      for (const container of containers) {
        // Simple health check - verify container is still running
        try {
          // This would be a more sophisticated health check in practice
          const isHealthy =
            container.status === 'ready' || container.status === 'busy';

          if (isHealthy) {
            healthStatus.healthyContainers++;
          } else {
            healthStatus.unhealthyContainers++;
          }

          healthStatus.details.push({
            id: container.id,
            toolName: container.toolName,
            status: container.status,
            healthy: isHealthy,
            lastUsed: container.lastUsed,
            uptime: Date.now() - container.created,
          });
        } catch (error) {
          healthStatus.unhealthyContainers++;
          healthStatus.details.push({
            id: container.id,
            toolName: container.toolName,
            status: 'error',
            healthy: false,
            error:
              error instanceof Error ? error.message : 'Health check failed',
          });
        }
      }

      return {
        success: true,
        data: healthStatus,
      };
    } catch (error) {
      console.error('Error during health check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

export default registerOptimizedDockerHandlers;
