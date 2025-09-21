import { FileTreeCacheService } from './FileTreeCacheService';
import { CityDataCacheService } from './CityDataCacheService';
import { FileTreeSource } from '../types/file-tree-source';
import type { FileChangeEvent } from '../../shared/types/git.types';
import { GitWatcherService } from '../main-process-api/GitWatcherService';

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
  private cacheService: FileTreeCacheService;
  private cityDataCache?: CityDataCacheService;
  private pendingInvalidations = new Map<string, Set<string>>(); // repoPath -> affected paths
  private invalidationTimer: NodeJS.Timeout | null = null;
  private structuralChangeTypes = new Set(['add', 'unlink']);

  constructor(
    cacheService: FileTreeCacheService,
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
    // Listen for file changes from GitRepositoryWatcher using proper service
    // TODO: GitWatcherService needs to expose file change events
    // For now, comment out to fix TypeScript errors
    console.log('[FileTreeInvalidator] File change listeners not yet implemented');
  }

  /**
   * Handle a file change event
   */
  private handleFileChange(event: FileChangeEvent): void {
    console.log(
      '[FileTreeInvalidator] File change:',
      event.type,
      event.path,
      'in',
      event.repoPath,
    );

    // Only care about structural changes (add/remove)
    // Content changes don't affect the FileTree structure
    if (!this.structuralChangeTypes.has(event.type)) {
      // For 'change' events, only care if it's a directory change
      if (event.type === 'change' && !event.isDirectory) {
        return;
      }
    }

    // Add to pending invalidations
    if (!this.pendingInvalidations.has(event.repoPath)) {
      this.pendingInvalidations.set(event.repoPath, new Set());
    }
    this.pendingInvalidations.get(event.repoPath)!.add(event.path);

    // Debounce invalidations to batch changes
    this.scheduleInvalidation();
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

    // Remove IPC listeners
    // TODO: Implement proper cleanup when GitWatcherService exposes events
    console.log('[FileTreeInvalidator] Cleanup not yet implemented');
  }
}
