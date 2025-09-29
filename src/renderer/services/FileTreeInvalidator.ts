import { MonitoredFileTreeService } from './MonitoredFileTreeService';
import { CityDataCacheService } from './CityDataCacheService';
import { FileTreeSource } from '../types/file-tree-source';
import type { GitStatusMetadata, GitStatusWithFiles } from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';

/**
 * Service that listens to file system changes and intelligently invalidates
 * the FileTree cache when needed.
 *
 * Strategy:
 * - Batch file changes to avoid excessive invalidations
 * - Only invalidate when structure changes (add/remove files)
 * - Ignore content-only changes unless they affect the tree structure
 */
export class FileTreeInvalidator {
  private cacheService: MonitoredFileTreeService;
  private cityDataCache?: CityDataCacheService;
  private pendingInvalidations = new Map<string, Set<string>>(); // repoPath -> affected paths
  private invalidationTimer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastStatusByRepo = new Map<string, GitStatusMetadata>();

  constructor(
    cacheService: MonitoredFileTreeService,
    cityDataCache?: CityDataCacheService,
  ) {
    this.cacheService = cacheService;
    this.cityDataCache = cityDataCache;
    this.setupListeners();
  }

  /**
   * Set up IPC listeners for file change events from main process
   */
  private setupListeners(): void {
    // Subscribe to git status changes from repository monitoring service
    this.unsubscribe = RepositoryMonitoringService.onGitStatusChanged(
      async (status) => {
        // Handle the git status change
        if (status.repoPath) {
          this.handleGitStatusChange(status);
        }
      }
    );

    console.log('[FileTreeInvalidator] Connected to repository monitoring service');
  }

  /**
   * Handle git status change from repository monitoring
   */
  private async handleGitStatusChange(status: GitStatusMetadata): Promise<void> {
    const repoPath = status.repoPath;
    if (!repoPath) return;

    // Get previous status for this repo
    const previousStatus = this.lastStatusByRepo.get(repoPath);

    // Store current status
    this.lastStatusByRepo.set(repoPath, status);

    // Check if there are structural changes (files added/removed)
    const hasStructuralChanges = this.detectStructuralChanges(previousStatus, status);

    if (hasStructuralChanges) {
      console.log(
        '[FileTreeInvalidator] Structural changes detected in',
        repoPath,
        '- scheduling invalidation'
      );

      // Add to pending invalidations
      if (!this.pendingInvalidations.has(repoPath)) {
        this.pendingInvalidations.set(repoPath, new Set());
      }

      // Add a marker to indicate we need to invalidate this repo
      this.pendingInvalidations.get(repoPath)!.add('git-status-change');

      // Debounce invalidations to batch changes
      this.scheduleInvalidation();
    }
  }

  /**
   * Detect if there are structural changes between two git statuses
   */
  private detectStructuralChanges(
    previous: GitStatusMetadata | undefined,
    current: GitStatus
  ): boolean {
    // If no previous status, consider it a structural change
    if (!previous) return true;

    // Simple heuristic: if the repository goes from clean to dirty or vice versa,
    // or if untracked files appear/disappear, it's likely a structural change

    // Check for changes in untracked files (new files added)
    if (current.hasUntracked !== previous.hasUntracked) return true;

    // Check if repository went from clean to dirty (files added/modified/deleted)
    if (current.isDirty !== previous.isDirty) return true;

    // For now, be conservative and invalidate on any status change
    // This ensures the FileTree stays in sync, though it may cause more invalidations than necessary
    // In the future, we could fetch GitStatusWithFiles for more precise detection
    return current.isDirty || current.hasUntracked;
  }

  /**
   * Schedule a batched invalidation
   */
  private scheduleInvalidation(): void {
    // Clear existing timer
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    // Wait 1 second to batch changes (e.g., multiple files being added)
    this.invalidationTimer = setTimeout(() => {
      this.processPendingInvalidations();
    }, 1000);
  }

  /**
   * Process all pending invalidations
   */
  private processPendingInvalidations(): void {
    if (this.pendingInvalidations.size === 0) return;

    console.log(
      '[FileTreeInvalidator] Processing invalidations for',
      this.pendingInvalidations.size,
      'repositories',
    );

    // Process each repository's changes
    for (const [
      repoPath,
      changedPaths,
    ] of this.pendingInvalidations.entries()) {
      this.invalidateRepository(repoPath, changedPaths);
    }

    // Clear pending invalidations
    this.pendingInvalidations.clear();
    this.invalidationTimer = null;
  }

  /**
   * Invalidate cache for a specific repository
   */
  private invalidateRepository(
    repoPath: string,
    changedPaths: Set<string>,
  ): void {
    console.log(
      '[FileTreeInvalidator] Invalidating cache for',
      repoPath,
      'with',
      changedPaths.size,
      'changed paths',
    );

    // Find all sources that match this repository path
    this.cacheService.invalidateMatching((source: FileTreeSource) => {
      // For local sources, check if the path matches
      if (source.type === 'local' && source.location === repoPath) {
        console.log(
          '[FileTreeInvalidator] Invalidating local source:',
          source.id,
        );
        return true;
      }
      return false;
    });

    // Also invalidate analysis cache for affected sources
    const affectedSourceIds = this.getAffectedSourceIds(repoPath);
    affectedSourceIds.forEach((sourceId) => {
      this.cacheService.removeAnalysis(sourceId);
    });

    // Invalidate city data cache for affected sources
    if (this.cityDataCache) {
      this.cityDataCache.invalidateMatching(() => true); // For now, invalidate all - could be more selective
    }

    // Emit an event that the cache was invalidated
    this.emitInvalidationEvent(repoPath, changedPaths);
  }

  /**
   * Get source IDs affected by changes to a repository
   */
  private getAffectedSourceIds(repoPath: string): string[] {
    // Generate possible source IDs for this repo
    return [
      `local-${repoPath}`,
      `local-${repoPath}-working`,
      `local-${repoPath}-HEAD`,
    ];
  }

  /**
   * Emit an event to notify UI components that cache was invalidated
   */
  private emitInvalidationEvent(
    repoPath: string,
    changedPaths: Set<string>,
  ): void {
    // Create a custom event
    const event = new CustomEvent('filetree:cache-invalidated', {
      detail: {
        repoPath,
        changedPaths: Array.from(changedPaths),
        timestamp: Date.now(),
      },
    });

    // Dispatch to window for any listeners
    window.dispatchEvent(event);
  }

  /**
   * Manually invalidate cache for a repository
   */
  invalidateNow(repoPath: string): void {
    console.log('[FileTreeInvalidator] Manual invalidation for', repoPath);
    this.invalidateRepository(repoPath, new Set(['manual-invalidation']));
  }

  /**
   * Set the city data cache (for cases where it's created after the invalidator)
   */
  setCityDataCache(cityDataCache: CityDataCacheService): void {
    this.cityDataCache = cityDataCache;
  }

  /**
   * Clean up listeners
   */
  destroy(): void {
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    // Unsubscribe from repository monitoring events
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Clear cached statuses
    this.lastStatusByRepo.clear();

    console.log('[FileTreeInvalidator] Cleaned up and unsubscribed from monitoring events');
  }
}
