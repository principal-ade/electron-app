import { BrowserWindow } from 'electron';
import { GitBranchService } from '../version-control-providers/gitBranchService';
import type { GitStatus } from '../../shared/types/git.types';

export type { GitStatus } from '../../shared/types/git.types';

interface CacheEntry {
  status: GitStatus;
  expiresAt: number;
}

/**
 * Service for managing git status with caching and async updates
 * Decouples git operations from window opening to improve performance
 */
export class GitStatusService {
  private static instance: GitStatusService;
  private branchService: GitBranchService;
  private cache: Map<string, CacheEntry> = new Map();
  private refreshPromises: Map<string, Promise<GitStatus | null>> = new Map();

  // Cache configuration
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

  private constructor() {
    this.branchService = new GitBranchService();
  }

  static getInstance(): GitStatusService {
    if (!GitStatusService.instance) {
      GitStatusService.instance = new GitStatusService();
    }
    return GitStatusService.instance;
  }

  /**
   * Get cached status immediately (non-blocking)
   * Returns null if not cached or expired
   */
  getCachedStatus(path: string): GitStatus | null {
    const entry = this.cache.get(path);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Expired, remove from cache
      this.cache.delete(path);
      return null;
    }

    // Update staleness
    const timeSinceUpdate = now - entry.status.lastUpdated;
    entry.status.isStale = timeSinceUpdate > this.STALE_THRESHOLD;

    return entry.status;
  }

  /**
   * Refresh git status asynchronously
   * If already refreshing, returns the existing promise
   */
  async refreshStatus(path: string): Promise<GitStatus | null> {
    // If already refreshing, return the existing promise
    const existingPromise = this.refreshPromises.get(path);
    if (existingPromise) {
      console.log(
        `[GitStatusService] Already refreshing ${path}, returning existing promise`,
      );
      return existingPromise;
    }

    // Mark as refreshing in cache
    const cachedEntry = this.cache.get(path);
    if (cachedEntry) {
      cachedEntry.status.isRefreshing = true;
    }

    // Create new refresh promise
    const refreshPromise = this._doRefresh(path);
    this.refreshPromises.set(path, refreshPromise);

    try {
      const status = await refreshPromise;
      return status;
    } finally {
      // Clean up promise
      this.refreshPromises.delete(path);

      // Mark as no longer refreshing
      const entry = this.cache.get(path);
      if (entry) {
        entry.status.isRefreshing = false;
      }
    }
  }

  /**
   * Internal refresh implementation
   */
  private async _doRefresh(path: string): Promise<GitStatus | null> {
    console.log(`[GitStatusService] Refreshing git status for ${path}`);
    const startTime = Date.now();

    try {
      const branchInfo = await this.branchService.getBranchInfo(path);
      if (!branchInfo) {
        console.log(`[GitStatusService] No git info found for ${path}`);
        return null;
      }

      const now = Date.now();
      const status: GitStatus = {
        ...branchInfo,
        path,
        lastUpdated: now,
        isStale: false,
        isRefreshing: false,
      };

      // Update cache
      this.cache.set(path, {
        status,
        expiresAt: now + this.CACHE_DURATION,
      });

      const duration = Date.now() - startTime;
      console.log(`[GitStatusService] Refreshed ${path} in ${duration}ms`);

      // Broadcast update to all windows
      this.broadcastStatusUpdate(status);

      return status;
    } catch (error) {
      console.error(`[GitStatusService] Error refreshing ${path}:`, error);
      return null;
    }
  }

  /**
   * Get status - returns cached if available, otherwise refreshes
   * This is a convenience method that combines getCached and refresh
   */
  async getStatus(path: string): Promise<GitStatus | null> {
    const cached = this.getCachedStatus(path);
    if (cached && !cached.isStale) {
      console.log(`[GitStatusService] Returning cached status for ${path}`);
      return cached;
    }

    // Refresh in background
    return this.refreshStatus(path);
  }

  /**
   * Broadcast git status update to all open windows
   */
  private broadcastStatusUpdate(status: GitStatus): void {
    const windows = BrowserWindow.getAllWindows();
    console.log(
      `[GitStatusService] Broadcasting status update to ${windows.length} windows`,
    );

    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('git-status-updated', status);
      }
    }
  }

  /**
   * Clear cache for a specific path
   */
  clearCache(path: string): void {
    this.cache.delete(path);
    console.log(`[GitStatusService] Cleared cache for ${path}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
    console.log('[GitStatusService] Cleared all cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ path: string; lastUpdated: number; isStale: boolean }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      lastUpdated: entry.status.lastUpdated,
      isStale: entry.status.isStale,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Prune expired entries from cache
   */
  pruneCache(): void {
    const now = Date.now();
    let pruned = 0;

    const entries = Array.from(this.cache.entries());
    for (const [path, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(path);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`[GitStatusService] Pruned ${pruned} expired cache entries`);
    }
  }
}

// Export singleton instance
export const gitStatusService = GitStatusService.getInstance();
