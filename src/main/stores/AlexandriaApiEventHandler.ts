/**
 * Main process handler for Alexandria repository management
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { AlexandriaAPI } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaAPIEvent } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import { AlexandriaRegistryService } from './AlexandriaRegistryService';
import type { AlexandriaEntry } from '@a24z/core-library';
import { RepositoryRegistrationManager } from '../repository-monitoring/RepositoryRegistrationManager';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';

export class AlexandriaApiEventHandler implements AlexandriaAPI {
  private registryService: AlexandriaRegistryService;

  constructor() {
    this.registryService = AlexandriaRegistryService.getInstance();
  }

  // This is implemented in the preload/renderer side, not in main process
  onRepositoryChange(): () => void {
    throw new Error('onRepositoryChange is only available in renderer process');
  }

  /**
   * Broadcast Alexandria events to all windows
   */
  private broadcastAlexandriaEvent(
    eventType:
      | AlexandriaAPIEvent.REPOSITORY_ADDED
      | AlexandriaAPIEvent.REPOSITORY_UPDATED
      | AlexandriaAPIEvent.REPOSITORY_REMOVED,
    data: AlexandriaEntry | { name: string },
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventType, data);
      }
    });
  }

  async getRepositories() {
    return this.registryService.getRepositories();
  }

  async getRepository(name: string) {
    return this.registryService.getRepository(name);
  }

  async getRepositoryByPath(path: string) {
    return this.registryService.getRepositoryByPath(path);
  }

  async registerRepository(name: string, path: string) {
    const repo = await this.registryService.registerRepository(name, path);
    // Broadcast the event to all windows
    this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_ADDED, repo);
    await this.registerWithMonitoring(repo);
    return repo;
  }

  async removeRepository(name: string, deleteLocal?: boolean) {
    const existing = await this.registryService.getRepository(name);
    const success = await this.registryService.removeRepository(name, deleteLocal);
    if (success) {
      // Broadcast the event to all windows
      this.broadcastAlexandriaEvent(AlexandriaAPIEvent.REPOSITORY_REMOVED, {
        name,
      });
      if (existing?.path) {
        await this.unregisterFromMonitoring(existing.path as string);
      }
    }
    return success;
  }

  async searchRepositories(query: string) {
    return this.registryService.searchRepositories(query);
  }

  async getRepositoriesWithViews() {
    return this.registryService.getRepositoriesWithViews();
  }

  async refreshRepository(name: string) {
    const repo = await this.registryService.refreshRepository(name);
    if (repo) {
      // Broadcast the event to all windows
      this.broadcastAlexandriaEvent(
        AlexandriaAPIEvent.REPOSITORY_UPDATED,
        repo,
      );
    }
    return repo;
  }

  async getRepositoryCount() {
    return this.registryService.getRepositoryCount();
  }

  private async registerWithMonitoring(repo: AlexandriaEntry): Promise<void> {
    if (!repo?.path) {
      return;
    }

    try {
      const monitoringManager = getRepositoryMonitoringManager();
      const registrationManager = RepositoryRegistrationManager.getInstance(monitoringManager);
      await registrationManager.handleRepositoryAdded(repo);
    } catch (error) {
      console.error('[Alexandria] Failed to register repository with monitoring:', error);
    }
  }

  private async unregisterFromMonitoring(repoPath: string): Promise<void> {
    try {
      const monitoringManager = getRepositoryMonitoringManager();
      const registrationManager = RepositoryRegistrationManager.getInstance(monitoringManager);
      await registrationManager.handleRepositoryRemoved(repoPath);
    } catch (error) {
      console.error('[Alexandria] Failed to unregister repository from monitoring:', error);
    }
  }

  /**
   * Clean up handlers when shutting down
   */
  destroy(): void {
    // Remove all handlers using enum values
    ipcMain.removeHandler(AlexandriaAPIEvent.GET_ALL);
    ipcMain.removeHandler(AlexandriaAPIEvent.GET);
    ipcMain.removeHandler(AlexandriaAPIEvent.GET_BY_PATH);
    ipcMain.removeHandler(AlexandriaAPIEvent.REGISTER);
    ipcMain.removeHandler(AlexandriaAPIEvent.REMOVE);
    ipcMain.removeHandler(AlexandriaAPIEvent.SEARCH);
    ipcMain.removeHandler(AlexandriaAPIEvent.GET_WITH_VIEWS);
    ipcMain.removeHandler(AlexandriaAPIEvent.REFRESH);
    ipcMain.removeHandler(AlexandriaAPIEvent.GET_COUNT);
  }
}

/**
 * Register Alexandria IPC handlers
 */
export function registerAlexandriaHandlers(): void {
  const handler = new AlexandriaApiEventHandler();

  // Register all IPC handlers using enum values
  ipcMain.handle(AlexandriaAPIEvent.GET_ALL, () => handler.getRepositories());
  ipcMain.handle(AlexandriaAPIEvent.GET, (_, name: string) =>
    handler.getRepository(name),
  );
  ipcMain.handle(AlexandriaAPIEvent.GET_BY_PATH, (_, path: string) =>
    handler.getRepositoryByPath(path),
  );
  ipcMain.handle(AlexandriaAPIEvent.REGISTER, (_, name: string, path: string) =>
    handler.registerRepository(name, path),
  );
  ipcMain.handle(AlexandriaAPIEvent.REMOVE, (_, name: string, deleteLocal?: boolean) =>
    handler.removeRepository(name, deleteLocal),
  );
  ipcMain.handle(AlexandriaAPIEvent.SEARCH, (_, query: string) =>
    handler.searchRepositories(query),
  );
  ipcMain.handle(AlexandriaAPIEvent.GET_WITH_VIEWS, () =>
    handler.getRepositoriesWithViews(),
  );
  ipcMain.handle(AlexandriaAPIEvent.REFRESH, (_, name: string) =>
    handler.refreshRepository(name),
  );
  ipcMain.handle(AlexandriaAPIEvent.GET_COUNT, () =>
    handler.getRepositoryCount(),
  );

  console.log('[Alexandria] IPC handlers registered');
}
