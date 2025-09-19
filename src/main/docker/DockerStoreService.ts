import { StaticNamespaces } from '../../shared/types/namespaces.types';
import {
  getTypedStorageManager,
  TypedMultiStoreWrapper,
} from '../storage-providers';
import {
  ToolContainerState,
  DockerAnalysisSession,
} from '../storage-providers/typed-namespaces';

/**
 * Service for managing Docker-related data in the typed store
 */
export class DockerStoreService {
  private static instance: DockerStoreService;
  private store: TypedMultiStoreWrapper;

  private constructor(store: TypedMultiStoreWrapper) {
    this.store = store;
  }

  static async getInstance(): Promise<DockerStoreService> {
    if (!DockerStoreService.instance) {
      const store = await getTypedStorageManager();
      DockerStoreService.instance = new DockerStoreService(store);
    }
    return DockerStoreService.instance;
  }

  // Container Management

  /**
   * Save container state
   */
  async saveContainerState(container: ToolContainerState): Promise<void> {
    const result = await this.store.set(
      container.id,
      container,
      StaticNamespaces.DOCKER_CONTAINERS,
    );
    if (!result.success) {
      throw new Error(
        `Failed to save container state: ${result.error?.message}`,
      );
    }
  }

  /**
   * Get container state by ID
   */
  async getContainerState(
    containerId: string,
  ): Promise<ToolContainerState | null> {
    const containers = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();

    for (const container of Object.values(containers)) {
      if (container.containerId === containerId) {
        return container;
      }
    }

    return null;
  }

  /**
   * Get all containers for a tool
   */
  async getContainersByTool(toolName: string): Promise<ToolContainerState[]> {
    const containers = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();

    return Object.values(containers).filter(
      (container) => container.toolName === toolName,
    );
  }

  /**
   * Get all active containers
   */
  async getAllContainers(): Promise<ToolContainerState[]> {
    const containers = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();
    return Object.values(containers);
  }

  /**
   * Remove container from store
   */
  async removeContainer(containerId: string): Promise<void> {
    const containers = await this.store
      .namespace(StaticNamespaces.DOCKER_CONTAINERS)
      .getAll();

    for (const [id, container] of Object.entries(containers)) {
      if (container.containerId === containerId) {
        const result = await this.store.delete(
          id,
          StaticNamespaces.DOCKER_CONTAINERS,
        );
        if (!result.success) {
          console.warn(`Failed to delete container ${id}:`, result.error);
        }
        break;
      }
    }
  }

  /**
   * Update container metrics
   */
  async updateContainerMetrics(
    containerId: string,
    metrics: Partial<ToolContainerState['metrics']>,
  ): Promise<void> {
    const container = await this.getContainerState(containerId);
    if (container) {
      container.metrics = { ...container.metrics, ...metrics };
      container.lastUsed = Date.now();
      await this.saveContainerState(container);
    }
  }

  /**
   * Mark container as busy
   */
  async markContainerBusy(
    containerId: string,
    sessionInfo: { sessionId: string; projectPath: string; startTime: number },
  ): Promise<void> {
    const container = await this.getContainerState(containerId);
    if (container) {
      container.status = 'busy';
      container.currentSession = sessionInfo;
      await this.saveContainerState(container);
    }
  }

  /**
   * Mark container as ready
   */
  async markContainerReady(containerId: string): Promise<void> {
    const container = await this.getContainerState(containerId);
    if (container) {
      container.status = 'ready';
      container.currentSession = undefined;
      container.lastUsed = Date.now();
      await this.saveContainerState(container);
    }
  }

  // Session Management

  /**
   * Save analysis session
   */
  async saveSession(session: DockerAnalysisSession): Promise<void> {
    const result = await this.store.set(
      session.id,
      session,
      StaticNamespaces.DOCKER_SESSIONS,
    );
    if (!result.success) {
      throw new Error(`Failed to save session: ${result.error?.message}`);
    }
  }

  /**
   * Get session by ID
   */
  async getSession(
    sessionId: string,
  ): Promise<DockerAnalysisSession | undefined> {
    const result = await this.store.get(
      sessionId,
      StaticNamespaces.DOCKER_SESSIONS,
    );
    if (!result.success) {
      throw new Error(`Failed to get session: ${result.error?.message}`);
    }
    return result.data;
  }

  /**
   * Get sessions by tool
   */
  async getSessionsByTool(
    toolName: string,
    limit?: number,
  ): Promise<DockerAnalysisSession[]> {
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();

    const filteredSessions = Object.values(sessions)
      .filter((session) => session.toolName === toolName)
      .sort((a, b) => b.startTime - a.startTime);

    return limit ? filteredSessions.slice(0, limit) : filteredSessions;
  }

  /**
   * Get sessions by repository
   */
  async getSessionsByRepository(
    repositoryUrl: string,
    limit?: number,
  ): Promise<DockerAnalysisSession[]> {
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();

    const filteredSessions = Object.values(sessions)
      .filter((session) => session.repositoryUrl === repositoryUrl)
      .sort((a, b) => b.startTime - a.startTime);

    return limit ? filteredSessions.slice(0, limit) : filteredSessions;
  }

  /**
   * Get recent sessions
   */
  async getRecentSessions(
    limit: number = 50,
  ): Promise<DockerAnalysisSession[]> {
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();

    return Object.values(sessions)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get sessions by status
   */
  async getSessionsByStatus(
    status: DockerAnalysisSession['status'],
    limit?: number,
  ): Promise<DockerAnalysisSession[]> {
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();

    const filteredSessions = Object.values(sessions)
      .filter((session) => session.status === status)
      .sort((a, b) => b.startTime - a.startTime);

    return limit ? filteredSessions.slice(0, limit) : filteredSessions;
  }

  /**
   * Get running sessions
   */
  async getRunningSessions(): Promise<DockerAnalysisSession[]> {
    return this.getSessionsByStatus('running');
  }

  /**
   * Get failed sessions
   */
  async getFailedSessions(
    limit: number = 20,
  ): Promise<DockerAnalysisSession[]> {
    return this.getSessionsByStatus('failed', limit);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: DockerAnalysisSession['status'],
    error?: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = status;
      if (error) {
        session.error = error;
      }
      if (
        status === 'completed' ||
        status === 'failed' ||
        status === 'cancelled'
      ) {
        session.endTime = Date.now();
        session.metrics.totalTime = session.endTime - session.startTime;
      }
      await this.saveSession(session);
    }
  }

  // Analytics and Statistics

  /**
   * Get tool usage statistics
   */
  async getToolStatistics(toolName: string): Promise<{
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    avgExecutionTime: number;
    totalExecutionTime: number;
    lastUsed?: number;
  }> {
    const sessions = await this.getSessionsByTool(toolName);

    const stats = {
      totalSessions: sessions.length,
      successfulSessions: sessions.filter((s) => s.status === 'completed')
        .length,
      failedSessions: sessions.filter((s) => s.status === 'failed').length,
      avgExecutionTime: 0,
      totalExecutionTime: 0,
      lastUsed: sessions[0]?.startTime,
    };

    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' && s.metrics.executionTime,
    );
    if (completedSessions.length > 0) {
      stats.totalExecutionTime = completedSessions.reduce(
        (sum, s) => sum + (s.metrics.executionTime || 0),
        0,
      );
      stats.avgExecutionTime =
        stats.totalExecutionTime / completedSessions.length;
    }

    return stats;
  }

  /**
   * Get repository analysis statistics
   */
  async getRepositoryStatistics(repositoryUrl: string): Promise<{
    totalAnalyses: number;
    toolsUsed: string[];
    lastAnalysis?: number;
    avgExecutionTime: number;
  }> {
    const sessions = await this.getSessionsByRepository(repositoryUrl);

    const toolsUsed = [...new Set(sessions.map((s) => s.toolName))];
    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' && s.metrics.executionTime,
    );

    return {
      totalAnalyses: sessions.length,
      toolsUsed,
      lastAnalysis: sessions[0]?.startTime,
      avgExecutionTime:
        completedSessions.length > 0
          ? completedSessions.reduce(
              (sum, s) => sum + (s.metrics.executionTime || 0),
              0,
            ) / completedSessions.length
          : 0,
    };
  }

  // Cleanup Operations

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();

    let deletedCount = 0;

    for (const [id, session] of Object.entries(sessions)) {
      if (
        session.startTime < cutoffTime &&
        (session.status === 'completed' || session.status === 'failed')
      ) {
        const result = await this.store.delete(
          id,
          StaticNamespaces.DOCKER_SESSIONS,
        );
        if (!result.success) {
          console.warn(`Failed to delete session ${id}:`, result.error);
        }
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Remove stale container entries
   */
  async removeStaleContainers(): Promise<number> {
    // This would need to be coordinated with the OptimizedDockerService
    // to check which containers are actually running
    const containers = await this.getAllContainers();
    let removedCount = 0;

    for (const container of containers) {
      // Mark as potential cleanup candidate if not used in 24 hours
      const hoursUnused = (Date.now() - container.lastUsed) / (1000 * 60 * 60);
      if (hoursUnused > 24 && container.status !== 'busy') {
        container.status = 'stopped';
        await this.saveContainerState(container);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get storage usage summary
   */
  async getStorageUsage(): Promise<{
    totalContainers: number;
    totalSessions: number;
    activeContainers: number;
    runningSessions: number;
  }> {
    const containers = await this.getAllContainers();
    const sessions = await this.store
      .namespace(StaticNamespaces.DOCKER_SESSIONS)
      .getAll();
    const allSessions = Object.values(sessions);

    return {
      totalContainers: containers.length,
      totalSessions: allSessions.length,
      activeContainers: containers.filter(
        (c) => c.status === 'ready' || c.status === 'busy',
      ).length,
      runningSessions: allSessions.filter((s) => s.status === 'running').length,
    };
  }
}

export const dockerStoreService = DockerStoreService.getInstance();
