/**
 * GitWatcherAdapter - Integrates @principal-ai/repository-monitoring library
 * Provides typed git events (commit, branch-switch, merge, dirty-state-change)
 * Emits GIT_STATE_EVENT for state transitions (separate from status snapshots)
 */

import { RepositoryMonitor, ChokidarWorkspaceWatcherAdapter } from '@principal-ai/repository-monitoring';
import type {
  GitEvent,
  GitState,
  RepositoryMonitorOptions,
  WorkspaceWatcherAdapter,
} from '@principal-ai/repository-monitoring';
import { EventEmitter } from 'events';
import * as path from 'path';
import {
  MonitoringInternalEvent,
  GitStateEvent,
  GitStateEventPayload,
  type FileChange,
  type FileChangeType,
  type WorkspaceChangeEventPayload,
} from './types';
import type { RepositoryMonitoringServer } from './RepositoryMonitoringServer';

/**
 * Configuration options for GitWatcherAdapter
 */
interface GitWatcherAdapterConfig {
  debounceMs?: number;
  watchMode?: 'watch' | 'poll';
  workspaceWatcherFactory?: () => WorkspaceWatcherAdapter;
}

/**
 * Adapter class that bridges the repository-monitoring library with our existing system
 */
export class GitWatcherAdapter extends EventEmitter {
  private repositoryMonitors: Map<string, RepositoryMonitor> = new Map();
  private config: GitWatcherAdapterConfig;
  private lastKnownState: Map<string, GitState> = new Map();
  private workspaceWatchers: Map<string, WorkspaceWatcherAdapter> = new Map();

  constructor(_server: RepositoryMonitoringServer, config: GitWatcherAdapterConfig = {}) {
    super();
    this.config = {
      debounceMs: config.debounceMs || 500,
      watchMode: config.watchMode || 'watch',
      workspaceWatcherFactory: config.workspaceWatcherFactory || (() => new ChokidarWorkspaceWatcherAdapter()),
    };
  }

  /**
   * Start watching a repository for git events
   */
  async startWatching(repoPath: string, mode: 'minimal' | 'fallback' = 'fallback'): Promise<void> {
    // Don't create duplicate monitors
    if (this.repositoryMonitors.has(repoPath)) {
      console.info(`[GitWatcherAdapter] Already watching ${repoPath}`);
      return;
    }

    try {
      console.info(`[GitWatcherAdapter] Starting git event watching for ${repoPath}`);

      // Create the repository monitor with options
      const options: RepositoryMonitorOptions = {
        repoPath,
        watch: this.config.watchMode === 'watch',
        debounceMs: this.config.debounceMs,
      };
      const monitor = new RepositoryMonitor(options);

      // Subscribe to specific git event types
      monitor.on('commit', (event: GitEvent) => {
        this.handleGitEvent(event);
      });

      monitor.on('branch-switch', (event: GitEvent) => {
        this.handleGitEvent(event);
      });

      monitor.on('merge', (event: GitEvent) => {
        this.handleGitEvent(event);
      });

      monitor.on('dirty-state-change', (event: GitEvent) => {
        this.handleGitEvent(event);
      });

      monitor.on('error', (error: Error) => {
        console.error(`[GitWatcherAdapter] Monitor error for ${repoPath}:`, error);
      });

      // Start watching
      await monitor.start();

      // Store the monitor
      this.repositoryMonitors.set(repoPath, monitor);

      await this.startWorkspaceWatcher(repoPath, mode);

      console.info(`[GitWatcherAdapter] Successfully started watching ${repoPath}`);
    } catch (error) {
      console.error(`[GitWatcherAdapter] Failed to start watching ${repoPath}:`, error);
      await this.stopWatching(repoPath);
      throw error;
    }
  }

  /**
   * Stop watching a repository
   */
  async stopWatching(repoPath: string): Promise<void> {
    try {
      const monitor = this.repositoryMonitors.get(repoPath);
      if (monitor) {
        await monitor.stop();
        this.repositoryMonitors.delete(repoPath);
      }

      const workspaceWatcher = this.workspaceWatchers.get(repoPath);
      if (workspaceWatcher) {
        await workspaceWatcher.stop();
        this.workspaceWatchers.delete(repoPath);
      }

      this.lastKnownState.delete(repoPath);
      console.info(`[GitWatcherAdapter] Stopped watching ${repoPath}`);
    } catch (error) {
      console.error(`[GitWatcherAdapter] Error stopping watch for ${repoPath}:`, error);
    }
  }

  /**
   * Handle git events from the library
   */
  private handleGitEvent(event: GitEvent): void {
    console.info(`[GitWatcherAdapter] Git state event detected:`, {
      type: event.type,
      repo: event.repoPath,
      branch: event.branch,
      sha: event.shortSha,
    });

    // Map library event to our clean git state event
    const gitStateEvent = this.mapToGitStateEvent(event);

    // Determine which cache fields should be updated based on event type
    const affectedCacheFields = this.determineAffectedCacheFields(event.type);

    // Create the event payload
    const payload: GitStateEventPayload = {
      event: gitStateEvent,
      affectedCacheFields,
    };

    // Emit the git state event (separate from status updates)
    this.emit(MonitoringInternalEvent.GIT_STATE_EVENT, payload);
  }

  private async startWorkspaceWatcher(repoPath: string, mode: 'minimal' | 'fallback'): Promise<void> {
    if (this.workspaceWatchers.has(repoPath)) {
      return;
    }

    const watcher = this.config.workspaceWatcherFactory?.();

    if (!watcher) {
      console.warn('[GitWatcherAdapter] Workspace watcher factory returned no instance, skipping workspace watching');
      return;
    }

    await watcher.start({
      repoPath,
      mode,
      debounceMs: this.config.debounceMs ?? 500,
      onChange: (event: string, filePath: string) => {
        this.handleWorkspaceChange(repoPath, event, filePath);
      },
      onReady: () => {
        console.info(`[GitWatcherAdapter] Workspace watcher ready for ${repoPath}`);
      },
      onClose: () => {
        console.info(`[GitWatcherAdapter] Workspace watcher closed for ${repoPath}`);
        this.workspaceWatchers.delete(repoPath);
      },
      onRestart: (reason: string) => {
        console.info(`[GitWatcherAdapter] Workspace watcher restarting for ${repoPath}: ${reason}`);
      },
      onError: (error: unknown) => {
        console.warn(`[GitWatcherAdapter] Workspace watcher error for ${repoPath}:`, error);
      },
      onFatalError: (error: unknown) => {
        console.error(`[GitWatcherAdapter] Workspace watcher fatal error for ${repoPath}:`, error);
        void watcher.stop().catch((stopError: unknown) => {
          console.error(`[GitWatcherAdapter] Failed to stop workspace watcher after fatal error for ${repoPath}:`, stopError);
        });
        this.workspaceWatchers.delete(repoPath);
        this.emitWorkspaceError(repoPath, error);
      },
    });

    this.workspaceWatchers.set(repoPath, watcher);
  }

  private handleWorkspaceChange(repoPath: string, event: string, filePath: string): void {
    const changeType = this.mapWorkspaceEventType(event);
    if (!changeType) {
      console.debug(`[GitWatcherAdapter] Ignoring workspace event ${event} for ${filePath}`);
      return;
    }

    const relativePath = path.relative(repoPath, filePath || repoPath).replace(/\\/g, '/');
    const change: FileChange = {
      type: changeType,
      path: relativePath,
    };

    const payload: WorkspaceChangeEventPayload = {
      repoPath,
      state: this.lastKnownState.get(repoPath),
      changes: [change],
    };

    this.emit(MonitoringInternalEvent.WORKSPACE_CHANGED, payload);
  }

  private mapWorkspaceEventType(event: string): FileChangeType | null {
    switch (event) {
      case 'add':
        return 'add';
      case 'change':
        return 'change';
      case 'unlink':
        return 'unlink';
      default:
        return null;
    }
  }

  private emitWorkspaceError(repoPath: string, _error: unknown): void {
    this.emit(MonitoringInternalEvent.WORKSPACE_CHANGED, {
      repoPath,
      state: this.lastKnownState.get(repoPath),
      changes: [],
    });
  }

  /**
   * Map library GitEvent to our GitStateEvent
   */
  private mapToGitStateEvent(event: GitEvent): GitStateEvent {
    const lastState = this.lastKnownState.get(event.repoPath);

    // Build git state event
    const gitStateEvent: GitStateEvent = {
      type: event.type,
      repoPath: event.repoPath,
      branch: event.branch,
      fullSha: event.fullSha,
      shortSha: event.shortSha,
      isDirty: event.isDirty,
      timestamp: event.timestamp,
    };

    // Add context for specific event types
    if (event.type === 'branch-switch' && lastState) {
      gitStateEvent.previousBranch = lastState.branch;
    }

    if (event.type === 'commit' && lastState) {
      gitStateEvent.previousSha = lastState.fullSha;
    }

    // Update our known state for next comparison
    this.lastKnownState.set(event.repoPath, {
      repoPath: event.repoPath,
      branch: event.branch,
      shortSha: event.shortSha,
      fullSha: event.fullSha,
      isDirty: event.isDirty,
      timestamp: event.timestamp,
      lastCommitTime: event.timestamp,
    });

    return gitStateEvent;
  }

  /**
   * Determine which cache fields should be updated based on event type
   */
  private determineAffectedCacheFields(eventType: string): string[] {
    switch (eventType) {
      case 'commit':
        return ['gitStatus', 'lastCommit'];

      case 'branch-switch':
        return ['gitStatus', 'gitBranch', 'fileTree'];

      case 'merge':
        return ['gitStatus', 'fileTree', 'lastCommit'];

      case 'dirty-state-change':
        return ['gitStatus'];

      default:
        return ['gitStatus'];
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): {
    watchingRepos: string[];
    config: GitWatcherAdapterConfig;
  } {
    return {
      watchingRepos: Array.from(this.repositoryMonitors.keys()),
      config: this.config,
    };
  }

  /**
   * Update configuration (for runtime changes)
   */
  updateConfig(config: Partial<GitWatcherAdapterConfig>): void {
    this.config = { ...this.config, ...config };
    console.info('[GitWatcherAdapter] Configuration updated:', this.config);
  }

  /**
   * Clean up all monitors
   */
  async dispose(): Promise<void> {
    console.info('[GitWatcherAdapter] Disposing all monitors...');
    const promises = Array.from(this.repositoryMonitors.keys()).map(
      repoPath => this.stopWatching(repoPath)
    );
    await Promise.all(promises);
    this.removeAllListeners();
  }
}