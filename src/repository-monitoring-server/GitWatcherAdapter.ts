/**
 * GitWatcherAdapter - Integrates @principal-ai/repository-monitoring library
 * Provides typed git events (commit, branch-switch, merge, dirty-state-change)
 * Emits GIT_STATE_EVENT for state transitions (separate from status snapshots)
 */

import { RepositoryMonitor } from '@principal-ai/repository-monitoring';
import type { GitEvent, GitState, RepositoryMonitorOptions } from '@principal-ai/repository-monitoring';
import { EventEmitter } from 'events';
import { MonitoringInternalEvent, GitStateEvent, GitStateEventPayload } from './types';
import type { RepositoryMonitoringServer } from './RepositoryMonitoringServer';

/**
 * Configuration options for GitWatcherAdapter
 */
interface GitWatcherAdapterConfig {
  debounceMs?: number;
  watchMode?: 'watch' | 'poll';
}

/**
 * Adapter class that bridges the repository-monitoring library with our existing system
 */
export class GitWatcherAdapter extends EventEmitter {
  private repositoryMonitors: Map<string, RepositoryMonitor> = new Map();
  private config: GitWatcherAdapterConfig;
  private server: RepositoryMonitoringServer;
  private lastKnownState: Map<string, GitState> = new Map();

  constructor(server: RepositoryMonitoringServer, config: GitWatcherAdapterConfig = {}) {
    super();
    this.server = server;
    this.config = {
      debounceMs: config.debounceMs || 500,
      watchMode: config.watchMode || 'watch',
    };
  }

  /**
   * Start watching a repository for git events
   */
  async startWatching(repoPath: string): Promise<void> {
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

      console.info(`[GitWatcherAdapter] Successfully started watching ${repoPath}`);
    } catch (error) {
      console.error(`[GitWatcherAdapter] Failed to start watching ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Stop watching a repository
   */
  async stopWatching(repoPath: string): Promise<void> {
    const monitor = this.repositoryMonitors.get(repoPath);
    if (!monitor) {
      return;
    }

    try {
      await monitor.stop();
      this.repositoryMonitors.delete(repoPath);
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