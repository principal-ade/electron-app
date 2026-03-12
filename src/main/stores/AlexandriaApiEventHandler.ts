/**
 * Alexandria Workspace Change Monitor
 *
 * Monitors workspace file changes and broadcasts repository update events.
 * IPC handlers have been migrated to TIPC router in src/main/alexandria/tipc/
 */

import { BrowserWindow } from 'electron';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';
import type { WorkspaceChangeEventPayload } from '@principal-ai/repository-monitoring-server';
import { getTracer } from '../telemetry';

// MonitoringInternalEvent constants (matching the package)
const MonitoringInternalEvent = {
  WORKSPACE_CHANGED: 'workspace-changed',
} as const;

/**
 * Alexandria Workspace Change Monitor
 *
 * Listens for file changes in .alexandria directories and broadcasts
 * repository update events to all windows.
 */
export class AlexandriaWorkspaceMonitor {
  private registryService: AlexandriaRegistryService;
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.registryService = AlexandriaRegistryService.getInstance();
    this.setupRepositoryMonitoring();
  }

  /**
   * Broadcast Alexandria events to all windows
   */
  private broadcastAlexandriaEvent(
    eventType: AlexandriaAPIEvent.REPOSITORY_UPDATED,
    data: AlexandriaEntry,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    const activeWindows = windows.filter((w) => !w.isDestroyed());

    const tracer = getTracer('alexandria-recently-opened');
    const span = tracer.startSpan(
      'alexandria.event.repository_updated_broadcast',
    );
    span.setAttributes({
      repository_name: data.name,
      window_count: activeWindows.length,
    });
    span.end();

    activeWindows.forEach((window) => {
      window.webContents.send(eventType, data);
    });
  }

  /**
   * Set up repository monitoring to listen for file changes
   */
  private setupRepositoryMonitoring(): void {
    try {
      const monitoringManager = getRepositoryMonitoringManager();

      monitoringManager.on(
        MonitoringInternalEvent.WORKSPACE_CHANGED,
        (payload: WorkspaceChangeEventPayload) => {
          this.handleWorkspaceChange(payload);
        },
      );

      console.log('[Alexandria] Subscribed to repository monitoring events');
    } catch (error) {
      console.error(
        '[Alexandria] Failed to setup repository monitoring:',
        error,
      );
    }
  }

  /**
   * Handle workspace change events from repository monitoring
   */
  private handleWorkspaceChange(payload: WorkspaceChangeEventPayload): void {
    const { repoPath, changes } = payload;

    // If no changes, ignore (likely a git state change without file details)
    if (!changes || changes.length === 0) {
      return;
    }

    // Check if any markdown files in the .alexandria directory were changed
    const hasAlexandriaMarkdownChanges = changes.some((change) => {
      const normalizedPath = change.path.toLowerCase();
      return (
        normalizedPath.includes('/.alexandria/') &&
        normalizedPath.endsWith('.md')
      );
    });

    if (!hasAlexandriaMarkdownChanges) {
      return;
    }

    // Debounce updates to avoid flooding on multiple file changes
    const existingTimer = this.updateTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.updateTimers.delete(repoPath);

      // Check if this repository is registered in Alexandria
      try {
        const repo = await this.registryService.getRepositoryByPath(repoPath);
        if (repo) {
          console.log(
            `[Alexandria] Detected markdown changes in ${repo.name}, broadcasting update`,
          );
          this.broadcastAlexandriaEvent(
            AlexandriaAPIEvent.REPOSITORY_UPDATED,
            repo,
          );
        }
      } catch (error) {
        console.error(
          '[Alexandria] Failed to broadcast repository update:',
          error,
        );
      }
    }, 500); // 500ms debounce

    this.updateTimers.set(repoPath, timer);
  }

  /**
   * Clean up handlers when shutting down
   */
  destroy(): void {
    // Clear all pending update timers
    for (const timer of this.updateTimers.values()) {
      clearTimeout(timer);
    }
    this.updateTimers.clear();
  }
}

// Singleton instance
let workspaceMonitor: AlexandriaWorkspaceMonitor | null = null;

/**
 * Initialize Alexandria workspace monitoring
 * This sets up listeners for file changes in .alexandria directories
 */
export function initializeAlexandriaMonitoring(): void {
  if (!workspaceMonitor) {
    workspaceMonitor = new AlexandriaWorkspaceMonitor();
    console.log('[Alexandria] Workspace monitoring initialized');
  }
}

/**
 * @deprecated Use initializeAlexandriaMonitoring instead.
 * This function is kept for backward compatibility during migration.
 */
export function registerAlexandriaHandlers(): void {
  initializeAlexandriaMonitoring();
}
