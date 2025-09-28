import { ipcMain, BrowserWindow } from 'electron';
import crypto from 'crypto';

import {
  type RepositoryAPI,
  RepositoryAPIEvent,
} from '../../shared/main-process-api-interfaces/RepositoryAPI';
import { Repository, VCSType } from '../../shared/types/repository.types';
import { GitBranchService } from '../version-control-providers/gitBranchService';
import { avatarStorageService } from '../version-control-providers/avatarStorageService';

import { StaticNamespaces } from '../storage-providers/types';
import { getTypedStorageManagerInstance } from './initialization';

// GitHub API Response Types
interface GitHubApiResponse {
  id?: number;
  name?: string;
  full_name?: string;
  owner?: {
    login: string;
    avatar_url: string;
  };
  description?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  default_branch?: string;
  topics?: string[];
  private?: boolean;
  fork?: boolean;
  license?: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
  };
  parent?: {
    owner: { login: string };
    name: string;
    html_url: string;
  };
  // For GitHub search API responses
  items?: GitHubApiResponse[];
  total_count?: number;
  // General URL property
  url?: string;
  html_url?: string;
}

// Repository Management Methods
export class RepositoryApiEventHandler implements RepositoryAPI {
  private branchService = new GitBranchService();

  /**
   * Broadcast repository events to all windows
   */
  private broadcastRepositoryEvent(
    event:
      | 'repository-added'
      | 'repository-updated'
      | 'repository-removed'
      | 'clone-added'
      | 'clone-removed',
    data: any,
  ): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(`repository:${event}`, data);
      }
    });
  }

  /**
   * Generate a storage key for a repository URL
   * Uses hash to avoid electron-store dot notation issues (same as RepositoryCache)
   */
  private getRepositoryKey(remoteUrl: string): string {
    const vcsType = this.detectVCSType(remoteUrl);
    const normalizedUrl = this.normalizeRepoUrl(remoteUrl, vcsType);
    const urlHash = crypto
      .createHash('sha256')
      .update(normalizedUrl)
      .digest('hex')
      .substring(0, 16);
    const key = `repos_${urlHash}`;
    console.log(
      `[getRepositoryKey] remoteUrl: ${remoteUrl} -> vcsType: ${vcsType} -> normalized: ${normalizedUrl} -> key: ${key}`,
    );
    return key;
  }

  /**
   * Refresh metadata for a repository (fetch avatar, description, etc.)
   */
  async refreshRepositoryMetadata(
    remoteUrl: string,
  ): Promise<Repository | undefined> {
    const repository = await this.getRepository(remoteUrl);
    if (!repository) return undefined;

    // Only refresh GitHub repos
    if (repository.vcsType !== 'github') return repository;

    // Fetch fresh metadata
    const metadata = await this.fetchGitHubMetadata(remoteUrl);
    if (!metadata) return repository;

    // Update the repository with new metadata
    const updates: Partial<Repository> = {
      avatarUrl: metadata.avatarUrl || repository.avatarUrl,
      description: metadata.description || repository.description,
      metadata: {
        ...repository.metadata,
        language: metadata.language,
        stars: metadata.stars,
        defaultBranch: metadata.defaultBranch,
        topics: metadata.topics,
        isPrivate: metadata.isPrivate,
        isFork: metadata.isFork,
        parentRepo: metadata.parentRepo,
      },
    };

    return await this.updateRepository(remoteUrl, updates);
  }

  /**
   * Get all repositories
   */
  async getRepositories(): Promise<Repository[]> {
    const typedManager = await getTypedStorageManagerInstance();

    try {
      const keysResult = await typedManager.keys(StaticNamespaces.REPOSITORIES);
      console.log('[getRepositories] Keys result:', keysResult);

      const repositories: Repository[] = [];

      // Filter for repo keys (repos_*)
      const repoKeys = keysResult.filter((key) => key.startsWith('repos_'));
      console.log('[getRepositories] Filtered repo keys:', repoKeys);

      // Load each repository
      for (const key of repoKeys) {
        const repoResult = await typedManager.get(
          key,
          StaticNamespaces.REPOSITORIES,
        );
        console.log(
          `[getRepositories] Result for key ${key}:`,
          repoResult.success ? 'success' : 'failed',
        );
        if (repoResult.success && repoResult.data) {
          console.log(
            `[getRepositories] Loaded repo: ${repoResult.data.name} with remoteUrl: ${repoResult.data.remoteUrl}`,
          );
          // Ensure tags array exists for backward compatibility
          if (!repoResult.data.tags) {
            repoResult.data.tags = [];
          }
          repositories.push(repoResult.data);
        }
      }

      console.log('[getRepositories] Final repositories array:', repositories);
      // Sort by last accessed
      return repositories.sort(
        (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
      );
    } catch (error) {
      console.error('Failed to get repositories:', error);
      return [];
    }
  }

  /**
   * Normalize repository URL based on VCS type
   */
  private normalizeRepoUrl(url: string, vcsType?: VCSType): string {
    // Remove trailing .git and slashes
    let normalized = url.replace(/\.git$/, '').replace(/\/$/, '');

    // Only lowercase for GitHub (case-insensitive)
    if (!vcsType || vcsType === 'github') {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  /**
   * Detect VCS type from URL
   */
  private detectVCSType(url: string): VCSType {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('github.com')) return 'github';
    if (lowerUrl.includes('gitlab.com') || lowerUrl.includes('gitlab.'))
      return 'gitlab';
    if (lowerUrl.includes('bitbucket.org')) return 'bitbucket';
    return 'generic';
  }

  /**
   * Fetch repository metadata from GitHub API
   */
  async fetchGitHubMetadata(remoteUrl: string): Promise<{
    name?: string;
    owner?: string;
    description?: string;
    avatarUrl?: string;
    language?: string;
    stars?: number;
    defaultBranch?: string;
    topics?: string[];
    isPrivate?: boolean;
    isFork?: boolean;
    url?: string;
    license?: {
      key: string;
      name: string;
      spdxId: string;
      url: string;
    };
    parentRepo?: {
      owner: string;
      name: string;
      url: string;
    };
  } | null> {
    try {
      // Extract owner and repo from URL
      // Allow dots in repo names (e.g., principal.md) but remove optional .git suffix
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      );
      if (!match) {
        console.log(
          '[fetchGitHubMetadata] Could not parse GitHub URL:',
          remoteUrl,
        );
        return null;
      }

      const [, owner, repo] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

      console.log('[fetchGitHubMetadata] Fetching metadata from:', apiUrl);

      // Fetch from GitHub API (no auth for public repos)
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PrincipleMD',
        },
      });

      if (response.status === 404) {
        // Repository is either private or doesn't exist
        console.log('[fetchGitHubMetadata] Repository is private or not found');
        return {
          // Even for private repos, return the parsed name and owner
          name: repo,
          owner: owner,
          isPrivate: true,
          // For private repos, we can still use the owner's avatar
          avatarUrl: `https://github.com/${owner}.png`,
        };
      }

      if (!response.ok) {
        console.error(
          '[fetchGitHubMetadata] API request failed:',
          response.status,
        );
        return null;
      }

      const data = (await response.json()) as GitHubApiResponse;

      return {
        // Include the actual repo name and owner from GitHub API
        name: data.name,
        owner: data.owner?.login,
        description: data.description,
        avatarUrl: data.owner?.avatar_url,
        language: data.language,
        stars: data.stargazers_count,
        defaultBranch: data.default_branch,
        topics: data.topics,
        isPrivate: data.private,
        isFork: data.fork,
        url: data.html_url,
        license: data.license
          ? {
              key: data.license.key,
              name: data.license.name,
              spdxId: data.license.spdx_id,
              url: data.license.url,
            }
          : undefined,
        parentRepo:
          data.fork && data.parent
            ? {
                owner: data.parent.owner.login,
                name: data.parent.name,
                url: data.parent.html_url,
              }
            : undefined,
      };
    } catch (error) {
      console.error('[fetchGitHubMetadata] Error fetching metadata:', error);
      // If API fails, try to extract owner and repo from URL
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      );
      if (match) {
        const [, owner, repo] = match;
        return {
          // Return the parsed name and owner as fallback
          name: repo,
          owner: owner,
          avatarUrl: `https://github.com/${owner}.png`,
        };
      }
      return null;
    }
  }

  /**
   * Get repository by remote URL
   */
  async getRepository(remoteUrl: string): Promise<Repository | undefined> {
    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      const repoResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );
      if (repoResult.success && repoResult.data) {
        // Ensure tags array exists for backward compatibility
        if (!repoResult.data.tags) {
          repoResult.data.tags = [];
        }
        return repoResult.data;
      }
    } catch (error) {
      console.error('Failed to get repository:', error);
    }

    return undefined;
  }

  /**
   * Add a new repository or update existing
   */
  async addRepository(params: {
    remoteUrl: string;
    owner: string;
    name: string;
    vcsType?: VCSType;
    localPath?: string;
    description?: string;
    avatarUrl?: string;
    metadata?: Repository['metadata'];
  }): Promise<Repository> {
    const vcsType = params.vcsType || this.detectVCSType(params.remoteUrl);
    const normalizedUrl = this.normalizeRepoUrl(params.remoteUrl, vcsType);

    // Fetch GitHub metadata if it's a GitHub repo and we don't have avatar/description
    let githubMetadata: any = null;
    if (vcsType === 'github' && (!params.avatarUrl || !params.description)) {
      githubMetadata = await this.fetchGitHubMetadata(params.remoteUrl);
    }

    // Try to get branch info from local path if provided
    let localBranchInfo: any = null;
    if (params.localPath) {
      try {
        localBranchInfo = await this.branchService.getBranchInfo(
          params.localPath,
        );
      } catch (error) {
        console.log(
          '[addRepository] Could not get branch info from local path:',
          error,
        );
      }
    }

    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(params.remoteUrl);

      // Check if repository already exists
      const existingResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );

      if (existingResult.success && existingResult.data) {
        // Update existing repository
        const existing = existingResult.data;

        // If a local path is provided, add it to localClones if not already there
        if (params.localPath) {
          const pathExists = existing.localClones.some(
            (clone) => clone.path === params.localPath,
          );

          if (!pathExists) {
            existing.localClones.push({
              path: params.localPath,
              addedAt: Date.now(),
              lastAccessed: Date.now(),
              currentBranch: localBranchInfo?.currentBranch,
            });
          }
        }

        // Update metadata if provided (use GitHub data if available)
        const updated: Repository = {
          ...existing,
          description:
            params.description ||
            githubMetadata?.description ||
            existing.description,
          avatarUrl:
            params.avatarUrl || githubMetadata?.avatarUrl || existing.avatarUrl,
          tags: existing.tags || [], // Ensure tags array exists
          metadata: {
            ...existing.metadata,
            ...params.metadata,
            ...(githubMetadata
              ? {
                  language: githubMetadata.language,
                  stars: githubMetadata.stars,
                  defaultBranch:
                    githubMetadata.defaultBranch ||
                    localBranchInfo?.defaultBranch,
                  topics: githubMetadata.topics,
                  isPrivate: githubMetadata.isPrivate,
                  isFork: githubMetadata.isFork,
                  license: githubMetadata.license,
                  parentRepo: githubMetadata.parentRepo,
                }
              : {}),
            // If GitHub API didn't provide defaultBranch, use local git info
            ...(!githubMetadata?.defaultBranch && localBranchInfo?.defaultBranch
              ? {
                  defaultBranch: localBranchInfo.defaultBranch,
                }
              : {}),
          },
          lastAccessed: Date.now(),
        };

        await typedManager.set(repoKey, updated, StaticNamespaces.REPOSITORIES);

        // Broadcast that repository was updated (may include new clone)
        this.broadcastRepositoryEvent('repository-updated', updated);

        return updated;
      } else {
        // Create new repository (use GitHub data if available)
        const newRepo: Repository = {
          remoteUrl: params.remoteUrl,
          vcsType,
          // Use GitHub API data if available, otherwise fall back to params
          owner: githubMetadata?.owner || params.owner,
          name: githubMetadata?.name || params.name,
          localClones: params.localPath
            ? [
                {
                  path: params.localPath,
                  addedAt: Date.now(),
                  lastAccessed: Date.now(),
                  currentBranch: localBranchInfo?.currentBranch,
                },
              ]
            : [],
          addedAt: Date.now(),
          lastAccessed: Date.now(),
          description: params.description || githubMetadata?.description,
          avatarUrl: params.avatarUrl || githubMetadata?.avatarUrl,
          tags: [], // Initialize empty tags array
          metadata: {
            ...params.metadata,
            ...(githubMetadata
              ? {
                  language: githubMetadata.language,
                  stars: githubMetadata.stars,
                  defaultBranch:
                    githubMetadata.defaultBranch ||
                    localBranchInfo?.defaultBranch,
                  topics: githubMetadata.topics,
                  isPrivate: githubMetadata.isPrivate,
                  isFork: githubMetadata.isFork,
                  license: githubMetadata.license,
                  parentRepo: githubMetadata.parentRepo,
                }
              : {}),
            // If GitHub API didn't provide defaultBranch, use local git info
            ...(!githubMetadata?.defaultBranch && localBranchInfo?.defaultBranch
              ? {
                  defaultBranch: localBranchInfo.defaultBranch,
                }
              : {}),
          },
        };

        await typedManager.set(repoKey, newRepo, StaticNamespaces.REPOSITORIES);

        // Broadcast that a new repository was added
        this.broadcastRepositoryEvent('repository-added', newRepo);

        return newRepo;
      }
    } catch (error) {
      console.error('Failed to add repository:', error);
      throw error;
    }
  }

  /**
   * Add a local clone to an existing repository
   */
  async addLocalClone(
    remoteUrl: string,
    localPath: string,
  ): Promise<Repository | undefined> {
    const typedManager = await getTypedStorageManagerInstance();

    // Get branch info for the local clone
    let branchInfo: any = null;
    try {
      branchInfo = await this.branchService.getBranchInfo(localPath);
    } catch (error) {
      console.log('[addLocalClone] Could not get branch info:', error);
    }

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      const repoResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );

      if (repoResult.success && repoResult.data) {
        const repo = repoResult.data;

        // Check if path already exists
        const pathExists = repo.localClones.some(
          (clone) => clone.path === localPath,
        );
        if (!pathExists) {
          repo.localClones.push({
            path: localPath,
            addedAt: Date.now(),
            lastAccessed: Date.now(),
            currentBranch: branchInfo?.currentBranch,
          });
          repo.lastAccessed = Date.now();

          // Update default branch if we don't have it yet
          if (!repo.metadata?.defaultBranch && branchInfo?.defaultBranch) {
            repo.metadata = {
              ...repo.metadata,
              defaultBranch: branchInfo.defaultBranch,
            };
          }

          await typedManager.set(repoKey, repo, StaticNamespaces.REPOSITORIES);

          // Broadcast that a new clone was added
          this.broadcastRepositoryEvent('clone-added', {
            repository: repo,
            clonePath: localPath,
          });
        }

        return repo;
      }
    } catch (error) {
      console.error('Failed to add local clone:', error);
    }

    return undefined;
  }

  /**
   * Remove a local clone from a repository
   */
  async removeLocalClone(
    remoteUrl: string,
    localPath: string,
  ): Promise<boolean> {
    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      const repoResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );

      if (repoResult.success && repoResult.data) {
        const repo = repoResult.data;
        const initialLength = repo.localClones.length;

        repo.localClones = repo.localClones.filter(
          (clone) => clone.path !== localPath,
        );

        // Only proceed if we actually removed something
        if (repo.localClones.length < initialLength) {
          if (repo.localClones.length === 0) {
            // If no local clones left, remove the entire repository
            await typedManager.delete(repoKey, StaticNamespaces.REPOSITORIES);

            // Broadcast that repository was removed
            this.broadcastRepositoryEvent('repository-removed', { remoteUrl });
          } else {
            // Update with remaining clones
            repo.lastAccessed = Date.now();
            await typedManager.set(
              repoKey,
              repo,
              StaticNamespaces.REPOSITORIES,
            );

            // Broadcast that a clone was removed
            this.broadcastRepositoryEvent('clone-removed', {
              repository: repo,
              clonePath: localPath,
            });
          }
          return true;
        }

        // Nothing was removed
        return false;
      }
    } catch (error) {
      console.error('Failed to remove local clone:', error);
    }

    return false;
  }

  /**
   * Update repository metadata
   */
  async updateRepository(
    remoteUrl: string,
    updates: Partial<
      Omit<Repository, 'remoteUrl' | 'owner' | 'name' | 'vcsType'>
    >,
  ): Promise<Repository | undefined> {
    console.log('[updateRepository] Called with remoteUrl:', remoteUrl);
    console.log(
      '[updateRepository] Updates:',
      JSON.stringify(updates, null, 2),
    );

    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      console.log('[updateRepository] Repository key:', repoKey);

      let repoResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );
      console.log(
        '[updateRepository] Get result:',
        repoResult.success,
        'Has data:',
        !!repoResult.data,
      );

      // If not found, try to find by matching normalized URL across all repositories
      if (!repoResult.data) {
        console.log(
          '[updateRepository] Repository not found by key, searching all repositories...',
        );
        const normalizedTarget = this.normalizeRepoUrl(
          remoteUrl,
          this.detectVCSType(remoteUrl),
        );
        const allRepos = await this.getRepositories();

        let foundRepo = null;
        let oldKey = null;

        for (const repo of allRepos) {
          const normalizedStored = this.normalizeRepoUrl(
            repo.remoteUrl,
            repo.vcsType,
          );
          if (normalizedStored === normalizedTarget) {
            console.log(
              `[updateRepository] Found matching repository: ${repo.name} with stored URL: ${repo.remoteUrl}`,
            );
            foundRepo = repo;
            oldKey = this.getRepositoryKey(repo.remoteUrl);
            break;
          }
        }

        if (foundRepo && oldKey) {
          // Found a matching repository with different URL casing
          console.log(
            `[updateRepository] Migrating repository from old URL: ${foundRepo.remoteUrl} to new URL: ${remoteUrl}`,
          );

          // Delete the old entry
          await typedManager.delete(oldKey, StaticNamespaces.REPOSITORIES);

          // Update the repository with the new URL
          foundRepo.remoteUrl = remoteUrl;

          // Save with the new key
          const newKey = this.getRepositoryKey(remoteUrl);
          await typedManager.set(
            newKey,
            foundRepo,
            StaticNamespaces.REPOSITORIES,
          );

          console.log(
            `[updateRepository] Migration complete. Old key: ${oldKey}, New key: ${newKey}`,
          );

          // Now get the migrated repository
          repoResult = await typedManager.get(
            newKey,
            StaticNamespaces.REPOSITORIES,
          );
        } else {
          console.log(
            '[updateRepository] No matching repository found. The repository may have been deleted or renamed.',
          );

          // Optionally, we could check if there's a stale entry to remove
          // by checking all repos for ones that don't exist on GitHub anymore
          console.log(
            '[updateRepository] Consider cleaning up stale repositories.',
          );
        }
      }

      if (repoResult.success && repoResult.data) {
        console.log(
          '[updateRepository] Existing metadata:',
          repoResult.data.metadata,
        );

        const updatedRepo = {
          ...repoResult.data,
          ...updates,
          // Properly merge metadata if it exists
          metadata: updates.metadata
            ? {
                ...repoResult.data.metadata,
                ...updates.metadata,
              }
            : repoResult.data.metadata,
          remoteUrl: repoResult.data.remoteUrl, // Ensure URL cannot be changed
          vcsType: repoResult.data.vcsType, // Ensure VCS type cannot be changed
          owner: repoResult.data.owner, // Ensure owner cannot be changed
          name: repoResult.data.name, // Ensure name cannot be changed
          tags: updates.tags || repoResult.data.tags || [], // Ensure tags array exists
        };

        console.log(
          '[updateRepository] Updated metadata:',
          updatedRepo.metadata,
        );

        // Use the repository's actual stored key for saving
        const saveKey = this.getRepositoryKey(repoResult.data.remoteUrl);
        const setResult = await typedManager.set(
          saveKey,
          updatedRepo,
          StaticNamespaces.REPOSITORIES,
        );
        console.log(
          '[updateRepository] Set result with key:',
          saveKey,
          'Result:',
          setResult,
        );

        // Broadcast the update
        this.broadcastRepositoryEvent('repository-updated', updatedRepo);

        return updatedRepo;
      } else {
        console.log(
          '[updateRepository] Repository not found for key:',
          repoKey,
        );
      }
    } catch (error) {
      console.error('[updateRepository] Failed to update repository:', error);
    }

    return undefined;
  }

  /**
   * Update repository last accessed time
   */
  async updateRepositoryAccess(remoteUrl: string): Promise<void> {
    await this.updateRepository(remoteUrl, { lastAccessed: Date.now() });
  }

  /**
   * Update local clone last accessed time
   */
  async updateLocalCloneAccess(
    remoteUrl: string,
    localPath: string,
  ): Promise<void> {
    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      const repoResult = await typedManager.get(
        repoKey,
        StaticNamespaces.REPOSITORIES,
      );

      if (repoResult.success && repoResult.data) {
        const repo = repoResult.data;
        const cloneIndex = repo.localClones.findIndex(
          (clone) => clone.path === localPath,
        );

        if (cloneIndex !== -1) {
          repo.localClones[cloneIndex].lastAccessed = Date.now();
          repo.lastAccessed = Date.now(); // Also update repo last accessed
          await typedManager.set(repoKey, repo, StaticNamespaces.REPOSITORIES);
        }
      }
    } catch (error) {
      console.error('Failed to update local clone access:', error);
    }
  }

  /**
   * Remove repository entirely
   */
  async removeRepository(remoteUrl: string): Promise<boolean> {
    const typedManager = await getTypedStorageManagerInstance();

    try {
      const repoKey = this.getRepositoryKey(remoteUrl);
      await typedManager.delete(repoKey, StaticNamespaces.REPOSITORIES);

      // Broadcast that repository was removed
      this.broadcastRepositoryEvent('repository-removed', { remoteUrl });

      return true;
    } catch (error) {
      console.error('Failed to remove repository:', error);
      return false;
    }
  }

  /**
   * Get recent repositories (sorted by last accessed)
   */
  async getRecentRepositories(limit: number = 5): Promise<Repository[]> {
    // Use getRepositories which already handles both patterns and sorts by last accessed
    const repositories = await this.getRepositories();

    return repositories.filter((repo) => repo.lastAccessed).slice(0, limit);
  }

  /**
   * Find repository by local path
   */
  async getRepositoryByLocalPath(
    localPath: string,
  ): Promise<Repository | undefined> {
    // Use getRepositories which handles both patterns
    const repositories = await this.getRepositories();

    return repositories.find((repo) =>
      repo.localClones.some((clone) => clone.path === localPath),
    );
  }

  /**
   * Get all repositories with local clones
   */
  async getLocalRepositories(): Promise<Repository[]> {
    // Use getRepositories which handles both patterns
    const repositories = await this.getRepositories();
    return repositories.filter((repo) => repo.localClones.length > 0);
  }

  /**
   * Search GitHub repositories
   * IMPORTANT: API calls should always be made from the main process, never from the renderer.
   * This ensures better security, rate limiting control, and potential token management.
   */
  async searchGitHubRepositories(
    query: string,
    options?: {
      sort?: 'stars' | 'forks' | 'updated';
      order?: 'asc' | 'desc';
      perPage?: number;
    },
  ): Promise<{
    items: Array<{
      id: number;
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      language: string | null;
    }>;
    total_count: number;
  }> {
    const sort = options?.sort || 'stars';
    const order = options?.order || 'desc';
    const perPage = options?.perPage || 10;

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&per_page=${perPage}`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            // Add User-Agent header for GitHub API
            'User-Agent': 'Principal-ADE-Electron-App',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as GitHubApiResponse;

      return {
        items: (data.items || []).map((item) => ({
          id: item.id || 0,
          full_name: item.full_name || '',
          html_url: item.html_url || '',
          description: item.description || null,
          stargazers_count: item.stargazers_count || 0,
          forks_count: item.forks_count || 0,
          language: item.language || null,
        })),
        total_count: data.total_count || 0,
      };
    } catch (error) {
      console.error('GitHub search failed:', error);
      throw error;
    }
  }

  /**
   * Set a custom avatar for a repository
   */
  async setRepositoryAvatar(
    remoteUrl: string,
    imageBase64: string,
  ): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    try {
      // Save the avatar image
      const result = await avatarStorageService.saveRepositoryAvatar(
        remoteUrl,
        imageBase64,
      );

      if (result.success && result.avatarPath) {
        // Update the repository with the avatar path
        await this.updateRepository(remoteUrl, {
          customAvatarPath: result.avatarPath,
        });
      }

      return result;
    } catch (error) {
      console.error('Error setting repository avatar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set a custom avatar for a clone
   */
  async setCloneAvatar(
    remoteUrl: string,
    clonePath: string,
    imageBase64: string,
  ): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    try {
      // Save the avatar image
      const result = await avatarStorageService.saveCloneAvatar(
        clonePath,
        imageBase64,
      );

      if (result.success && result.avatarPath) {
        // Update the clone with the avatar path
        const repository = await this.getRepository(remoteUrl);
        if (repository) {
          const updatedClones = repository.localClones.map((clone) =>
            clone.path === clonePath
              ? { ...clone, customAvatarPath: result.avatarPath }
              : clone,
          );
          await this.updateRepository(remoteUrl, {
            localClones: updatedClones,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error setting clone avatar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a custom avatar from a repository
   */
  async removeRepositoryAvatar(
    remoteUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove the avatar file
      const result =
        await avatarStorageService.removeRepositoryAvatar(remoteUrl);

      if (result.success) {
        // Update the repository to remove the avatar path
        await this.updateRepository(remoteUrl, { customAvatarPath: undefined });
      }

      return result;
    } catch (error) {
      console.error('Error removing repository avatar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a custom avatar from a clone
   */
  async removeCloneAvatar(
    remoteUrl: string,
    clonePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove the avatar file
      const result = await avatarStorageService.removeCloneAvatar(clonePath);

      if (result.success) {
        // Update the clone to remove the avatar path
        const repository = await this.getRepository(remoteUrl);
        if (repository) {
          const updatedClones = repository.localClones.map((clone) =>
            clone.path === clonePath
              ? { ...clone, customAvatarPath: undefined }
              : clone,
          );
          await this.updateRepository(remoteUrl, {
            localClones: updatedClones,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error removing clone avatar:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the URL/data for an avatar
   */
  async getAvatarUrl(avatarPath: string): Promise<string | null> {
    try {
      return await avatarStorageService.getAvatarUrl(avatarPath);
    } catch (error) {
      console.error('Error getting avatar URL:', error);
      return null;
    }
  }

  /**
   * Clean up stale repositories (ones that no longer exist or have been renamed)
   * This can be called periodically or when issues are detected
   */
  async cleanupStaleRepositories(): Promise<{
    removed: string[];
    updated: string[];
  }> {
    console.log('[cleanupStaleRepositories] Starting cleanup...');
    const typedManager = await getTypedStorageManagerInstance();
    const removed: string[] = [];
    const updated: string[] = [];

    try {
      const allRepos = await this.getRepositories();

      for (const repo of allRepos) {
        // Check if it's a GitHub repository
        if (repo.vcsType === 'github') {
          try {
            // Try to fetch current metadata from GitHub
            const metadata = await this.fetchGitHubMetadata(repo.remoteUrl);

            if (!metadata) {
              // Repository doesn't exist on GitHub anymore
              console.log(
                `[cleanupStaleRepositories] Repository no longer exists: ${repo.remoteUrl}`,
              );
              const key = this.getRepositoryKey(repo.remoteUrl);
              await typedManager.delete(key, StaticNamespaces.REPOSITORIES);
              removed.push(repo.remoteUrl);
            } else if (metadata.url && metadata.url !== repo.remoteUrl) {
              // Repository URL has changed (renamed)
              console.log(
                `[cleanupStaleRepositories] Repository renamed from ${repo.remoteUrl} to ${metadata.url}`,
              );

              // Delete old entry
              const oldKey = this.getRepositoryKey(repo.remoteUrl);
              await typedManager.delete(oldKey, StaticNamespaces.REPOSITORIES);

              // Update repository with new URL
              repo.remoteUrl = metadata.url;
              repo.name = metadata.name || repo.name;
              repo.owner = metadata.owner || repo.owner;

              // Save with new key
              const newKey = this.getRepositoryKey(metadata.url);
              await typedManager.set(
                newKey,
                repo,
                StaticNamespaces.REPOSITORIES,
              );

              updated.push(`${repo.remoteUrl} -> ${metadata.url}`);
            }
          } catch (error) {
            console.error(
              `[cleanupStaleRepositories] Error checking repository ${repo.remoteUrl}:`,
              error,
            );
          }
        }
      }

      console.log(
        `[cleanupStaleRepositories] Cleanup complete. Removed: ${removed.length}, Updated: ${updated.length}`,
      );
      return { removed, updated };
    } catch (error) {
      console.error('[cleanupStaleRepositories] Cleanup failed:', error);
      return { removed, updated };
    }
  }
}

/**
 * Register IPC handlers for repository operations
 */
export function registerRepositoryHandlers(): void {
  const repositoryApiEventHandler = new RepositoryApiEventHandler();
  // Repository Management Handlers
  ipcMain.handle(
    RepositoryAPIEvent.GET_ALL,
    repositoryApiEventHandler.getRepositories.bind(repositoryApiEventHandler),
  );

  ipcMain.handle(RepositoryAPIEvent.GET, async (_, remoteUrl: string) => {
    try {
      return await repositoryApiEventHandler.getRepository(remoteUrl);
    } catch (error) {
      console.error('Error getting repository:', error);
      throw error;
    }
  });

  ipcMain.handle(RepositoryAPIEvent.ADD, async (_, params) => {
    try {
      return await repositoryApiEventHandler.addRepository(params);
    } catch (error) {
      console.error('Error adding repository:', error);
      throw error;
    }
  });

  ipcMain.handle(
    RepositoryAPIEvent.UPDATE,
    async (_, remoteUrl: string, updates) => {
      console.log(
        '[IPC UPDATE] Handler called with remoteUrl:',
        remoteUrl,
        'updates:',
        updates,
      );
      try {
        const result = await repositoryApiEventHandler.updateRepository(
          remoteUrl,
          updates,
        );
        console.log(
          '[IPC UPDATE] Returning result:',
          result ? 'Repository object' : 'undefined',
        );
        return result;
      } catch (error) {
        console.error('[IPC UPDATE] Error updating repository:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.UPDATE_ACCESS,
    async (_, remoteUrl: string) => {
      try {
        return await repositoryApiEventHandler.updateRepositoryAccess(
          remoteUrl,
        );
      } catch (error) {
        console.error('Error updating repository access:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(RepositoryAPIEvent.REMOVE, async (_, remoteUrl: string) => {
    try {
      return await repositoryApiEventHandler.removeRepository(remoteUrl);
    } catch (error) {
      console.error('Error removing repository:', error);
      throw error;
    }
  });

  ipcMain.handle(RepositoryAPIEvent.GET_RECENT, async (_, limit?: number) => {
    try {
      return await repositoryApiEventHandler.getRecentRepositories(limit);
    } catch (error) {
      console.error('Error getting recent repositories:', error);
      throw error;
    }
  });

  // Local clone management handlers
  ipcMain.handle(
    RepositoryAPIEvent.ADD_LOCAL_CLONE,
    async (_, remoteUrl: string, localPath: string) => {
      try {
        return await repositoryApiEventHandler.addLocalClone(
          remoteUrl,
          localPath,
        );
      } catch (error) {
        console.error('Error adding local clone:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.REMOVE_LOCAL_CLONE,
    async (_, remoteUrl: string, localPath: string) => {
      try {
        return await repositoryApiEventHandler.removeLocalClone(
          remoteUrl,
          localPath,
        );
      } catch (error) {
        console.error('Error removing local clone:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.UPDATE_LOCAL_CLONE_ACCESS,
    async (_, remoteUrl: string, localPath: string) => {
      try {
        return await repositoryApiEventHandler.updateLocalCloneAccess(
          remoteUrl,
          localPath,
        );
      } catch (error) {
        console.error('Error updating local clone access:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.GET_BY_LOCAL_PATH,
    async (_, localPath: string) => {
      try {
        return await repositoryApiEventHandler.getRepositoryByLocalPath(
          localPath,
        );
      } catch (error) {
        console.error('Error getting repository by local path:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(RepositoryAPIEvent.GET_LOCAL, async () => {
    try {
      return await repositoryApiEventHandler.getLocalRepositories();
    } catch (error) {
      console.error('Error getting local repositories:', error);
      throw error;
    }
  });

  ipcMain.handle(
    RepositoryAPIEvent.REFRESH_METADATA,
    async (_, remoteUrl: string) => {
      try {
        return await repositoryApiEventHandler.refreshRepositoryMetadata(
          remoteUrl,
        );
      } catch (error) {
        console.error('Error refreshing repository metadata:', error);
        throw error;
      }
    },
  );

  // GitHub Search Handler
  ipcMain.handle(
    RepositoryAPIEvent.SEARCH_GITHUB_REPOSITORIES,
    async (
      _,
      query: string,
      options?: {
        sort?: 'stars' | 'forks' | 'updated';
        order?: 'asc' | 'desc';
        perPage?: number;
      },
    ) => {
      try {
        return await repositoryApiEventHandler.searchGitHubRepositories(
          query,
          options,
        );
      } catch (error) {
        console.error('Error searching GitHub repositories:', error);
        throw error;
      }
    },
  );

  // Cleanup stale repositories
  ipcMain.handle(RepositoryAPIEvent.CLEANUP_STALE, async () => {
    try {
      return await repositoryApiEventHandler.cleanupStaleRepositories();
    } catch (error) {
      console.error('Error cleaning up stale repositories:', error);
      throw error;
    }
  });

  // Avatar Management Handlers
  ipcMain.handle(
    RepositoryAPIEvent.SET_REPOSITORY_AVATAR,
    async (_, remoteUrl: string, imageBase64: string) => {
      try {
        return await repositoryApiEventHandler.setRepositoryAvatar(
          remoteUrl,
          imageBase64,
        );
      } catch (error) {
        console.error('Error setting repository avatar:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.SET_CLONE_AVATAR,
    async (_, remoteUrl: string, clonePath: string, imageBase64: string) => {
      try {
        return await repositoryApiEventHandler.setCloneAvatar(
          remoteUrl,
          clonePath,
          imageBase64,
        );
      } catch (error) {
        console.error('Error setting clone avatar:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.REMOVE_REPOSITORY_AVATAR,
    async (_, remoteUrl: string) => {
      try {
        return await repositoryApiEventHandler.removeRepositoryAvatar(
          remoteUrl,
        );
      } catch (error) {
        console.error('Error removing repository avatar:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.REMOVE_CLONE_AVATAR,
    async (_, remoteUrl: string, clonePath: string) => {
      try {
        return await repositoryApiEventHandler.removeCloneAvatar(
          remoteUrl,
          clonePath,
        );
      } catch (error) {
        console.error('Error removing clone avatar:', error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    RepositoryAPIEvent.GET_AVATAR_URL,
    async (_, avatarPath: string) => {
      try {
        return await repositoryApiEventHandler.getAvatarUrl(avatarPath);
      } catch (error) {
        console.error('Error getting avatar URL:', error);
        throw error;
      }
    },
  );
}
