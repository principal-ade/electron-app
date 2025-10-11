/**
 * RepositoryRegistrationManager - Handles automatic registration of all repositories
 * with the monitoring server on app startup
 */

import { app } from 'electron';
import { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import type { AlexandriaEntry } from '@a24z/core-library';

export class RepositoryRegistrationManager {
  private static instance: RepositoryRegistrationManager | null = null;
  private monitoringManager: RepositoryMonitoringManager;
  private isInitialized = false;
  private registeredPaths = new Set<string>();

  private constructor(monitoringManager: RepositoryMonitoringManager) {
    this.monitoringManager = monitoringManager;
  }

  static getInstance(
    monitoringManager: RepositoryMonitoringManager,
  ): RepositoryRegistrationManager {
    if (!this.instance) {
      this.instance = new RepositoryRegistrationManager(monitoringManager);
    }
    return this.instance;
  }

  /**
   * Initialize and register all repositories on app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[RepositoryRegistrationManager] Already initialized');
      return;
    }

    console.log(
      '[RepositoryRegistrationManager] Initializing repository registration...',
    );

    try {
      // Ensure app is ready
      if (!app.isReady()) {
        await app.whenReady();
      }

      // Get all repositories from Alexandria
      const repositories = await this.getAllRepositories();
      console.log(
        `[RepositoryRegistrationManager] Found ${repositories.length} repositories to register`,
      );

      // Register all repositories with monitoring server
      await this.registerAllRepositories(repositories);

      // Enable git watching for ALL repositories (resource usage is minimal with shallow watching)
      await this.enableGitWatchingForAll(repositories);

      // Listen for repository lifecycle events
      this.setupRepositoryLifecycleListeners();

      this.isInitialized = true;
      console.log('[RepositoryRegistrationManager] Initialization complete');
    } catch (error) {
      console.error(
        '[RepositoryRegistrationManager] Failed to initialize:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get all repositories from Alexandria storage
   */
  private async getAllRepositories(): Promise<AlexandriaEntry[]> {
    try {
      const registryService = AlexandriaRegistryService.getInstance();
      const repositories = await registryService.getRepositories();
      return repositories;
    } catch (error) {
      console.error(
        '[RepositoryRegistrationManager] Failed to get repositories:',
        error,
      );
      return [];
    }
  }

  /**
   * Register all repositories with the monitoring server
   */
  private async registerAllRepositories(
    repositories: AlexandriaEntry[],
  ): Promise<void> {
    const batchSize = 5; // Register 5 at a time to avoid overwhelming the server

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (repo) => {
          try {
            const pathString = repo.path as string;
            console.log(
              `[RepositoryRegistrationManager] Registering repository: ${repo.name} at ${pathString}`,
            );
            await this.monitoringManager.registerRepository(pathString);
            this.registeredPaths.add(pathString);

            // Don't pre-fetch git status here - it will be fetched when git watching is enabled
          } catch (error) {
            console.error(
              `[RepositoryRegistrationManager] Failed to register ${repo.name}:`,
              error,
            );
          }
        }),
      );
    }
  }

  /**
   * Enable git watching for all repositories
   * Resource usage is minimal with shallow watching (depth: 2)
   */
  private async enableGitWatchingForAll(
    repositories: AlexandriaEntry[],
  ): Promise<void> {
    console.log(
      '[RepositoryRegistrationManager] Enabling git watching for all repositories...',
    );

    const batchSize = 5; // Enable watching 5 at a time

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (repo) => {
          try {
            const pathString = repo.path as string;
            console.log(
              `[RepositoryRegistrationManager] Enabling git watching for: ${repo.name}`,
            );
            await this.monitoringManager.enableGitWatching(pathString);
          } catch (error) {
            console.error(
              `[RepositoryRegistrationManager] Failed to enable git watching for ${repo.name}:`,
              error,
            );
          }
        }),
      );
    }

    console.log(
      '[RepositoryRegistrationManager] Git watching enabled for all repositories',
    );
  }

  /**
   * Setup listeners for repository add/remove events
   */
  private setupRepositoryLifecycleListeners(): void {
    // Listen for Alexandria repository events
    // Note: We'll need to add event emitters to Alexandria storage
    // For now, we'll handle this through IPC events
    console.log(
      '[RepositoryRegistrationManager] Repository lifecycle listeners setup complete',
    );
  }

  /**
   * Handle a new repository being added
   */
  async handleRepositoryAdded(repo: AlexandriaEntry): Promise<void> {
    const pathString = repo.path as string;
    if (this.registeredPaths.has(pathString)) {
      console.log(
        `[RepositoryRegistrationManager] Repository already registered: ${repo.name}`,
      );
      return;
    }

    try {
      console.log(
        `[RepositoryRegistrationManager] Registering new repository: ${repo.name}`,
      );
      await this.monitoringManager.registerRepository(pathString);
      await this.monitoringManager.enableGitWatching(pathString);
      this.registeredPaths.add(pathString);
    } catch (error) {
      console.error(
        `[RepositoryRegistrationManager] Failed to register new repository ${repo.name}:`,
        error,
      );
    }
  }

  /**
   * Handle a repository being removed
   */
  async handleRepositoryRemoved(repoPath: string): Promise<void> {
    if (!this.registeredPaths.has(repoPath)) {
      console.log(
        `[RepositoryRegistrationManager] Repository not registered: ${repoPath}`,
      );
      return;
    }

    try {
      console.log(
        `[RepositoryRegistrationManager] Unregistering repository: ${repoPath}`,
      );
      await this.monitoringManager.disableGitWatching(repoPath);
      await this.monitoringManager.unregisterRepository(repoPath);
      this.registeredPaths.delete(repoPath);
    } catch (error) {
      console.error(
        `[RepositoryRegistrationManager] Failed to unregister repository ${repoPath}:`,
        error,
      );
    }
  }

  /**
   * Get registration status
   */
  getStatus(): {
    isInitialized: boolean;
    registeredCount: number;
    registeredPaths: string[];
  } {
    return {
      isInitialized: this.isInitialized,
      registeredCount: this.registeredPaths.size,
      registeredPaths: Array.from(this.registeredPaths),
    };
  }

  /**
   * Refresh all repository registrations
   */
  async refreshAll(): Promise<void> {
    console.log(
      '[RepositoryRegistrationManager] Refreshing all repository registrations...',
    );

    const repositories = await this.getAllRepositories();
    // Convert ValidatedRepositoryPath to string for comparison
    const currentPaths = new Set(repositories.map((r) => r.path as string));

    // Unregister repositories that no longer exist
    for (const path of this.registeredPaths) {
      if (!currentPaths.has(path)) {
        await this.handleRepositoryRemoved(path);
      }
    }

    // Register new repositories
    for (const repo of repositories) {
      const pathString = repo.path as string;
      if (!this.registeredPaths.has(pathString)) {
        await this.handleRepositoryAdded(repo);
      }
    }
  }
}
