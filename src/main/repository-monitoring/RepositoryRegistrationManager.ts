/**
 * RepositoryRegistrationManager - Keeps the monitoring daemon's repository set
 * in step with the Alexandria registry, and warms watches for the repos the
 * user was most recently working in.
 */

import { app } from 'electron';
import { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
import type { IAlexandriaRegistryService } from './interfaces';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

/** The repository identity needed for incremental registration. */
export interface RepositoryRegistrationEntry {
  name: string;
  path: string;
}

/**
 * How many repositories get a watch at startup. A watcher per registered repo
 * is far too expensive (~100 repos), so only the most recently opened ones are
 * warmed; everything else is watched on demand (workspace, repo profile,
 * terminal).
 */
export const STARTUP_WATCH_LIMIT = 10;

/** Watch reference held by this manager for startup-warmed repos. */
export const STARTUP_WATCH_REFERENCE = 'RepositoryRegistrationManager';

/**
 * Pick the repositories to watch at startup: the `limit` most recently
 * opened (by `lastOpenedAt`). Entries never opened are skipped — there is no
 * signal they're active. Never throws.
 */
export function selectStartupWatchRepositories(
  repositories: ReadonlyArray<AlexandriaEntry>,
  limit = STARTUP_WATCH_LIMIT,
): AlexandriaEntry[] {
  return repositories
    .filter((repo) => repo.path && repo.lastOpenedAt)
    .map((repo) => ({
      repo,
      openedAt: new Date(repo.lastOpenedAt as string).getTime(),
    }))
    .filter(({ openedAt }) => Number.isFinite(openedAt))
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, Math.max(0, limit))
    .map(({ repo }) => repo);
}

export interface RepositoryRegistrationManagerConfig {
  monitoringManager: RepositoryMonitoringManager;
  alexandriaRegistryService?: IAlexandriaRegistryService;
}

export class RepositoryRegistrationManager {
  private static instance: RepositoryRegistrationManager | null = null;
  private monitoringManager: RepositoryMonitoringManager;
  private alexandriaRegistryService?: IAlexandriaRegistryService;
  private isInitialized = false;
  private registeredPaths = new Set<string>();

  private constructor(config: RepositoryRegistrationManagerConfig) {
    this.monitoringManager = config.monitoringManager;
    this.alexandriaRegistryService = config.alexandriaRegistryService;
  }

  static getInstance(
    config: RepositoryRegistrationManagerConfig,
  ): RepositoryRegistrationManager {
    this.instance ??= new RepositoryRegistrationManager(config);
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

      // Warm watches for the repos the user was most recently in, so Home
      // shows live git status for them right away. Nothing else is registered
      // or watched here: the daemon auto-registers on acquireWatch, and a
      // registered-but-unwatched repo would still cost periodic remote probes.
      const repositories = await this.getAllRepositories();
      const toWatch = selectStartupWatchRepositories(repositories);
      console.log(
        `[RepositoryRegistrationManager] Watching ${String(toWatch.length)} of ${String(repositories.length)} repositories at startup (most recently opened)`,
      );
      await this.watchStartupRepositories(toWatch);

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
    if (!this.alexandriaRegistryService) {
      console.warn(
        '[RepositoryRegistrationManager] No Alexandria registry service provided',
      );
      return [];
    }
    try {
      const repositories =
        await this.alexandriaRegistryService.getRepositories();
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
   * Acquire a startup watch for each repository, a few at a time so the
   * daemon isn't hit with every watcher spawn at once. acquireWatch registers
   * the repo as a side effect, so it's tracked as registered too.
   */
  private async watchStartupRepositories(
    repositories: AlexandriaEntry[],
  ): Promise<void> {
    const batchSize = 5;

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (repo) => {
          const pathString = repo.path as string;
          try {
            console.log(
              `[RepositoryRegistrationManager] Watching repository: ${repo.name} at ${pathString}`,
            );
            await this.monitoringManager.acquireWatch(
              pathString,
              STARTUP_WATCH_REFERENCE,
            );
            this.registeredPaths.add(pathString);
          } catch (error) {
            console.error(
              `[RepositoryRegistrationManager] Failed to watch ${repo.name}:`,
              error,
            );
          }
        }),
      );
    }
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
  async handleRepositoryAdded(
    repo: RepositoryRegistrationEntry,
  ): Promise<void> {
    const pathString = repo.path;
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
      this.registeredPaths.add(pathString);

      // Registration only — watching starts on demand (see initialize()).
      console.log(
        `[RepositoryRegistrationManager] Registered new repository (no watch): ${repo.name}`,
      );
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
      await this.monitoringManager.releaseWatch(
        repoPath,
        STARTUP_WATCH_REFERENCE,
      );
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
