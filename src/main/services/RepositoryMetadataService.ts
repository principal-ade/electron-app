import { BrowserWindow } from 'electron';
import { RepositoryApiEventHandler } from '../stores/RepositoryApiEventHandler';
import type { Repository } from '../../shared/types/repository.types';

interface MetadataCache {
  data: Repository;
  expiresAt: number;
}

/**
 * Service for managing repository metadata with caching and async updates
 * Decouples GitHub API calls from window opening to improve performance
 */
export class RepositoryMetadataService {
  private static instance: RepositoryMetadataService;
  private repositoryHandler: RepositoryApiEventHandler;
  private cache: Map<string, MetadataCache> = new Map();
  private refreshPromises: Map<string, Promise<Repository | undefined>> =
    new Map();

  // Cache configuration
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  private constructor() {
    this.repositoryHandler = new RepositoryApiEventHandler();
  }

  static getInstance(): RepositoryMetadataService {
    if (!RepositoryMetadataService.instance) {
      RepositoryMetadataService.instance = new RepositoryMetadataService();
    }
    return RepositoryMetadataService.instance;
  }

  /**
   * Get cached metadata immediately (non-blocking)
   * Returns null if not cached or expired
   */
  getCachedMetadata(remoteUrl: string): Repository | null {
    const entry = this.cache.get(remoteUrl);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      // Expired, remove from cache
      this.cache.delete(remoteUrl);
      return null;
    }

    return entry.data;
  }

  /**
   * Refresh metadata asynchronously
   * If already refreshing, returns the existing promise
   */
  async refreshMetadata(remoteUrl: string): Promise<Repository | undefined> {
    // If already refreshing, return the existing promise
    const existingPromise = this.refreshPromises.get(remoteUrl);
    if (existingPromise) {
      console.log(
        `[RepositoryMetadataService] Already refreshing ${remoteUrl}, returning existing promise`,
      );
      return existingPromise;
    }

    // Create new refresh promise
    const refreshPromise = this._doRefresh(remoteUrl);
    this.refreshPromises.set(remoteUrl, refreshPromise);

    try {
      const metadata = await refreshPromise;
      return metadata;
    } finally {
      // Clean up promise
      this.refreshPromises.delete(remoteUrl);
    }
  }

  /**
   * Internal refresh implementation
   */
  private async _doRefresh(remoteUrl: string): Promise<Repository | undefined> {
    console.log(
      `[RepositoryMetadataService] Refreshing metadata for ${remoteUrl}`,
    );
    const startTime = Date.now();

    try {
      const metadata =
        await this.repositoryHandler.refreshRepositoryMetadata(remoteUrl);
      if (!metadata) {
        console.log(
          `[RepositoryMetadataService] No metadata found for ${remoteUrl}`,
        );
        return undefined;
      }

      const now = Date.now();

      // Update cache
      this.cache.set(remoteUrl, {
        data: metadata,
        expiresAt: now + this.CACHE_DURATION,
      });

      const duration = Date.now() - startTime;
      console.log(
        `[RepositoryMetadataService] Refreshed ${remoteUrl} in ${duration}ms`,
      );

      // Broadcast update to all windows
      this.broadcastMetadataUpdate(remoteUrl, metadata);

      return metadata;
    } catch (error) {
      console.error(
        `[RepositoryMetadataService] Error refreshing ${remoteUrl}:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Get metadata from database (synchronous-ish)
   */
  async getFromDatabase(remoteUrl: string): Promise<Repository | undefined> {
    try {
      return await this.repositoryHandler.getRepository(remoteUrl);
    } catch (error) {
      console.error(
        `[RepositoryMetadataService] Error fetching from database:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Get metadata - returns cached if available, otherwise fetches from DB
   * Does NOT trigger network refresh (use refreshMetadata for that)
   */
  async getMetadata(remoteUrl: string): Promise<Repository | undefined> {
    // Try cache first
    const cached = this.getCachedMetadata(remoteUrl);
    if (cached) {
      console.log(
        `[RepositoryMetadataService] Returning cached metadata for ${remoteUrl}`,
      );
      return cached;
    }

    // Fetch from database
    return this.getFromDatabase(remoteUrl);
  }

  /**
   * Get fallback avatar URL for when we don't have one cached
   * Uses GitHub's avatar endpoint which doesn't require auth
   */
  getFallbackAvatarUrl(remoteUrl: string): string | null {
    try {
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      );
      if (!match) return null;

      const [, owner] = match;
      return `https://github.com/${owner}.png?size=200`;
    } catch (error) {
      console.error(
        '[RepositoryMetadataService] Error generating fallback avatar:',
        error,
      );
      return null;
    }
  }

  /**
   * Broadcast metadata update to all open windows
   */
  private broadcastMetadataUpdate(
    remoteUrl: string,
    metadata: Repository,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    console.log(
      `[RepositoryMetadataService] Broadcasting metadata update to ${windows.length} windows`,
    );

    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send('repository-metadata-updated', {
          remoteUrl,
          metadata,
        });
      }
    }
  }

  /**
   * Clear cache for a specific URL
   */
  clearCache(remoteUrl: string): void {
    this.cache.delete(remoteUrl);
    console.log(`[RepositoryMetadataService] Cleared cache for ${remoteUrl}`);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
    console.log('[RepositoryMetadataService] Cleared all cache');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ remoteUrl: string; hasAvatar: boolean }>;
  } {
    const entries = Array.from(this.cache.entries()).map(
      ([remoteUrl, entry]) => ({
        remoteUrl,
        hasAvatar: !!entry.data.avatarUrl,
      }),
    );

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
    for (const [remoteUrl, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(remoteUrl);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(
        `[RepositoryMetadataService] Pruned ${pruned} expired cache entries`,
      );
    }
  }
}

// Export singleton instance
export const repositoryMetadataService =
  RepositoryMetadataService.getInstance();
