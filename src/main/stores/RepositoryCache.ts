import { Repository, VCSType } from '../../shared/types/repository.types';
import { GitService } from '../version-control-providers/GitService';
import type { GitInfo } from '../../shared/types/git.types';

import path from 'path';
import crypto from 'crypto';
import { getTypedStorageManagerInstance } from './initialization';
import { StaticNamespaces } from '../storage-providers/types';

interface CacheEntry {
  localPath: string;
  remoteUrl: string;
  gitInfo: GitInfo;
  timestamp: number;
}

export class RepositoryCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private gitService: GitService;
  private cacheTimeout = 10 * 60 * 1000; // 10 minutes
  private repositoriesCache: Map<string, Repository> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.gitService = new GitService();
    // Don't initialize immediately - wait for first access
  }

  /**
   * Generate a storage key for a repository URL
   * Uses hash to avoid electron-store dot notation issues
   */
  private getRepositoryKey(remoteUrl: string): string {
    const urlHash = crypto
      .createHash('sha256')
      .update(remoteUrl)
      .digest('hex')
      .substring(0, 16);
    return `repos_${urlHash}`;
  }

  /**
   * Ensure cache is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      console.log(
        `[RepositoryCache] Cache already initialized (${this.memoryCache.size} entries)`,
      );
      return;
    }

    if (this.initPromise) {
      console.log(`[RepositoryCache] Waiting for cache initialization...`);
      return this.initPromise;
    }

    console.log(`[RepositoryCache] Starting cache initialization...`);
    this.initPromise = this.initializeCache();
    await this.initPromise;
    this.initialized = true;
    console.log(`[RepositoryCache] Cache initialization complete`);
  }

  /**
   * Initialize cache from storage using type-safe store
   */
  private async initializeCache(): Promise<void> {
    try {
      const typedStore = await getTypedStorageManagerInstance();

      // Get all repository keys
      const keys = await typedStore.keys(StaticNamespaces.REPOSITORIES);

      // Load all repositories
      for (const key of keys) {
        if (key.startsWith('repos_')) {
          const result = await typedStore.get(
            key,
            StaticNamespaces.REPOSITORIES,
          );
          if (result.success && result.data) {
            const repo = result.data;
            this.repositoriesCache.set(repo.remoteUrl, repo);

            // Populate memory cache with local clones
            for (const clone of repo.localClones) {
              const cacheEntry: CacheEntry = {
                localPath: clone.path,
                remoteUrl: repo.remoteUrl,
                gitInfo: {
                  root: clone.path,
                  remoteUrl: repo.remoteUrl,
                  branch: clone.currentBranch,
                  owner: repo.owner,
                  repo: repo.name,
                },
                timestamp: Date.now(),
              };
              this.memoryCache.set(clone.path, cacheEntry);
            }
          }
        }
      }

      console.log(
        `[RepositoryCache] Initialized with ${this.memoryCache.size} local clones from ${this.repositoriesCache.size} repositories`,
      );
    } catch (error) {
      console.error('[RepositoryCache] Failed to initialize:', error);
    }
  }

  /**
   * Get repository info for a path, checking cache first
   */
  async getRepositoryForPath(workingDirectory: string): Promise<{
    repository: Repository;
    gitInfo: GitInfo;
  } | null> {
    console.log(
      `[RepositoryCache] Getting repository for path: "${workingDirectory}"`,
    );

    // Ensure cache is initialized
    await this.ensureInitialized();
    // Check if this exact path is in cache
    let cacheEntry = this.memoryCache.get(workingDirectory);

    // If not found, check parent directories
    if (!cacheEntry) {
      // Check if any cached path is a parent of this directory
      for (const [cachedPath, entry] of this.memoryCache.entries()) {
        if (
          workingDirectory.startsWith(cachedPath + path.sep) ||
          workingDirectory === cachedPath
        ) {
          cacheEntry = entry;
          break;
        }
      }
    }

    // Check if cache is still valid
    if (cacheEntry && Date.now() - cacheEntry.timestamp < this.cacheTimeout) {
      const repository = this.repositoriesCache.get(cacheEntry.remoteUrl);
      if (repository) {
        return {
          repository,
          gitInfo: cacheEntry.gitInfo,
        };
      }
    }

    // Cache miss or expired - get git info
    // Need to ensure we pass a directory to getGitInfo, not a file path
    const fs = require('fs');
    let directoryForGit = workingDirectory;

    console.log(
      `[RepositoryCache] Cache miss for: "${workingDirectory}", checking path type`,
    );

    // Check if the path is a file, and if so, get its directory
    try {
      const stats = await fs.promises.stat(workingDirectory);
      if (stats.isFile()) {
        directoryForGit = path.dirname(workingDirectory);
        console.log(
          `[RepositoryCache] Path is a file, using directory: "${directoryForGit}"`,
        );
      } else {
        console.log(
          `[RepositoryCache] Path is a directory: "${workingDirectory}"`,
        );
      }
    } catch (error) {
      // Path doesn't exist or is inaccessible, try using it as-is or its parent
      // This could be a file that doesn't exist yet (being created)
      directoryForGit = path.dirname(workingDirectory);
      console.log(
        `[RepositoryCache] Path doesn't exist, using parent directory: "${directoryForGit}"`,
      );
      console.log(`[RepositoryCache] Path stat error:`, error);
    }

    console.log(
      `[RepositoryCache] Calling GitService.getGitInfo with: "${directoryForGit}"`,
    );
    const gitInfo = await this.gitService.getGitInfo(directoryForGit);
    if (!gitInfo || !gitInfo.remoteUrl) {
      return null;
    }

    // Update or create repository
    let repository = this.repositoriesCache.get(gitInfo.remoteUrl);
    const typedStore = await getTypedStorageManagerInstance();
    let isNewRepository = false;

    if (!repository) {
      // Try to load from storage
      const repoKey = this.getRepositoryKey(gitInfo.remoteUrl);
      const repoResult = await typedStore.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );

      if (repoResult.success && repoResult.data) {
        repository = repoResult.data;
      } else {
        // Create new repository
        repository = {
          remoteUrl: gitInfo.remoteUrl,
          vcsType: this.detectVCSType(gitInfo.remoteUrl),
          owner: gitInfo.owner || 'unknown',
          name: gitInfo.repo || 'unknown',
          localClones: [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
        };
        isNewRepository = true;
      }

      this.repositoriesCache.set(gitInfo.remoteUrl, repository);
    }

    // Update local clone info
    let localClone = repository.localClones.find(
      (c) => c.path === gitInfo.root,
    );
    let needsPersist = false;

    if (!localClone) {
      localClone = {
        path: gitInfo.root,
        addedAt: Date.now(),
        lastAccessed: Date.now(),
        currentBranch: gitInfo.branch,
      };
      repository.localClones.push(localClone);
      needsPersist = true;
    } else if (localClone.currentBranch !== gitInfo.branch) {
      localClone.currentBranch = gitInfo.branch;
      localClone.lastAccessed = Date.now();
      needsPersist = true;
    }

    // Persist if new or updated
    if (isNewRepository || needsPersist) {
      const repoKey = this.getRepositoryKey(gitInfo.remoteUrl);
      const result = await typedStore.set(
        repoKey,
        repository,
        StaticNamespaces.REPOSITORIES,
      );

      if (!result.success) {
        console.error(
          '[RepositoryCache] Failed to persist repository:',
          result.error,
        );
      }
    }

    // Update memory cache
    const newCacheEntry: CacheEntry = {
      localPath: gitInfo.root,
      remoteUrl: gitInfo.remoteUrl,
      gitInfo,
      timestamp: Date.now(),
    };
    this.memoryCache.set(workingDirectory, newCacheEntry);

    // Also cache the git root itself
    if (workingDirectory !== gitInfo.root) {
      this.memoryCache.set(gitInfo.root, newCacheEntry);
    }

    return {
      repository,
      gitInfo,
    };
  }

  /**
   * Update repository access time using type-safe store
   */
  async updateRepositoryAccess(remoteUrl: string): Promise<void> {
    // Ensure cache is initialized
    await this.ensureInitialized();
    const repository = this.repositoriesCache.get(remoteUrl);
    if (repository) {
      repository.lastAccessed = Date.now();

      // Persist to storage using type-safe store
      const typedStore = await getTypedStorageManagerInstance();
      const repoKey = this.getRepositoryKey(remoteUrl);

      const result = await typedStore.set(
        repoKey,
        repository,
        StaticNamespaces.REPOSITORIES,
      );

      if (!result.success) {
        console.error(
          '[RepositoryCache] Failed to update repository access time:',
          result.error,
        );
      }
    }
  }

  /**
   * Get all repositories from cache
   */
  async getAllRepositories(): Promise<Repository[]> {
    // Ensure cache is initialized
    await this.ensureInitialized();
    return Array.from(this.repositoriesCache.values());
  }

  /**
   * Clear the memory cache (useful for testing)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    console.log('[RepositoryCache] Memory cache cleared');
  }

  /**
   * Detect VCS type from remote URL
   */
  private detectVCSType(remoteUrl: string): VCSType {
    if (remoteUrl.includes('github.com')) return 'github';
    if (remoteUrl.includes('gitlab.com')) return 'gitlab';
    if (remoteUrl.includes('bitbucket.org')) return 'bitbucket';
    return 'generic';
  }
}

// Export singleton instance
export const repositoryCache = new RepositoryCache();
