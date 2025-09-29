/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @a24z/core-library for local repository management
 */

import {
  AlexandriaOutpostManager,
  NodeFileSystemAdapter,
} from '@a24z/core-library';
import type { AlexandriaEntry } from '@a24z/core-library';
import { gitClientFactory } from '../utils/gitClientFactory';
import { FileSystemService } from '../file-system-service';
import { LocalNodeGlobAdapter } from '../adapters/LocalNodeGlobAdapter';

export class AlexandriaRegistryService {
  private static instance: AlexandriaRegistryService;
  private outpostManager: AlexandriaOutpostManager;
  private initialized = false;

  private constructor() {
    // Create filesystem and glob adapters for outpost manager
    const fsAdapter = new NodeFileSystemAdapter();
    const globAdapter = new LocalNodeGlobAdapter(); // Use our local fixed adapter
    this.outpostManager = new AlexandriaOutpostManager(fsAdapter, globAdapter);
  }

  static getInstance(): AlexandriaRegistryService {
    if (!AlexandriaRegistryService.instance) {
      AlexandriaRegistryService.instance = new AlexandriaRegistryService();
    }
    return AlexandriaRegistryService.instance;
  }

  /**
   * Get all repositories with path information and git commit data
   */
  async getRepositories(): Promise<AlexandriaEntry[]> {
    // Use getAllEntries to get repositories with path information
    const entries = this.outpostManager.getAllEntries();

    // Enrich each repository with last commit information
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        try {
          // Get last commit info from git
          const commitInfo = await gitClientFactory.getLastCommitInfo(entry.path);

          // Debug: log commit message to check if it's full or truncated
          if (commitInfo?.message && entry.name === 'electron-app') {
            console.log(`[Alexandria] Commit message for ${entry.name}:`, commitInfo.message);
          }

          if (commitInfo && commitInfo.date) {
            // Update the github field with last commit date only (per type constraints)
            // Store other commit details at the top level
            const enrichedEntry = {
              ...entry,
              github: {
                ...entry.github,
                lastCommit: commitInfo.date, // ISO date string from git
              },
              // Additional commit details (not part of GithubRepository type)
              lastCommitMessage: commitInfo.message,
              lastCommitAuthor: commitInfo.author,
              lastCommitHash: commitInfo.shortHash || commitInfo.hash,
            } as AlexandriaEntry;
            return enrichedEntry;
          }
        } catch (error) {
          // If git info fails, just continue silently
        }

        // Return original entry if no git info available
        return entry;
      })
    );

    return enrichedEntries;
  }

  /**
   * Get repository by name with git info
   */
  async getRepository(name: string): Promise<AlexandriaEntry | null> {
    // Get all entries and find by name
    const entries = this.outpostManager.getAllEntries();
    const entry = entries.find((e) => e.name === name);

    if (!entry) return null;

    // Try to enrich with git info
    try {
      const commitInfo = await gitClientFactory.getLastCommitInfo(entry.path);
      if (commitInfo) {
        return {
          ...entry,
          github: {
            ...entry.github,
            lastCommit: commitInfo.date,
          },
          // Additional commit details (not part of GithubRepository type)
          lastCommitMessage: commitInfo.message,
          lastCommitAuthor: commitInfo.author,
          lastCommitHash: commitInfo.shortHash || commitInfo.hash,
        } as AlexandriaEntry;
      }
    } catch (error) {
      // Silently continue if git info fails
    }

    return entry;
  }

  /**
   * Get repository by local path with git info
   */
  async getRepositoryByPath(path: string): Promise<AlexandriaEntry | null> {
    // Get all entries and find by path
    const entries = this.outpostManager.getAllEntries();
    const entry = entries.find((e) => e.path === path);

    if (!entry) return null;

    // Try to enrich with git info
    try {
      const commitInfo = await gitClientFactory.getLastCommitInfo(entry.path);
      if (commitInfo) {
        return {
          ...entry,
          github: {
            ...entry.github,
            lastCommit: commitInfo.date,
          },
          // Additional commit details (not part of GithubRepository type)
          lastCommitMessage: commitInfo.message,
          lastCommitAuthor: commitInfo.author,
          lastCommitHash: commitInfo.shortHash || commitInfo.hash,
        } as AlexandriaEntry;
      }
    } catch (error) {
      // Silently continue if git info fails
    }

    return entry;
  }

  /**
   * Fetch GitHub metadata for a repository using git CLI fallback for private repos
   */
  private async fetchGitHubMetadata(
    path: string,
    remoteUrl?: string,
  ): Promise<{
    owner?: string;
    name?: string;
    description?: string;
    language?: string;
    stars?: number;
    defaultBranch?: string;
    topics?: string[];
    isPrivate?: boolean;
  } | null> {
    try {
      // If no remote URL provided, try to get it from git
      if (!remoteUrl) {
        const remotes = await gitClientFactory.getRemotes(path);
        const originRemote = remotes.find((r) => r.name === 'origin');
        remoteUrl = originRemote?.url;
      }

      if (!remoteUrl) {
        console.log('[fetchGitHubMetadata] No remote URL found');
        return null;
      }

      // Check if it's a GitHub URL
      if (!remoteUrl.includes('github.com')) {
        console.log('[fetchGitHubMetadata] Not a GitHub repository');
        return null;
      }

      // Extract owner and repo from URL
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
      );
      if (!match) {
        console.log('[fetchGitHubMetadata] Could not parse GitHub URL:', remoteUrl);
        return null;
      }

      const [, owner, repoName] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;

      console.log('[fetchGitHubMetadata] Fetching metadata from:', apiUrl);

      // Try GitHub API
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PrincipalADE-Electron',
        },
      });

      if (response.status === 404) {
        // Repository is private or doesn't exist
        // Use git CLI fallback with parsed info
        console.log('[fetchGitHubMetadata] Repository is private, using git CLI info');
        return {
          owner: owner,
          name: repoName,
          isPrivate: true,
        };
      }

      if (!response.ok) {
        console.error('[fetchGitHubMetadata] API request failed:', response.status);
        // Still return basic info from parsed URL
        return {
          owner: owner,
          name: repoName,
        };
      }

      const data = await response.json() as {
        owner?: { login: string };
        name?: string;
        description?: string;
        language?: string;
        stargazers_count?: number;
        default_branch?: string;
        topics?: string[];
        private?: boolean;
      };

      return {
        owner: data.owner?.login || owner,
        name: data.name || repoName,
        description: data.description,
        language: data.language,
        stars: data.stargazers_count,
        defaultBranch: data.default_branch,
        topics: data.topics,
        isPrivate: data.private,
      };
    } catch (error) {
      console.error('[fetchGitHubMetadata] Error fetching metadata:', error);

      // Last resort: try to parse from remote URL if we have it
      if (remoteUrl && remoteUrl.includes('github.com')) {
        const match = remoteUrl.match(
          /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
        );
        if (match) {
          const [, owner, repoName] = match;
          return {
            owner: owner,
            name: repoName,
          };
        }
      }

      return null;
    }
  }

  /**
   * Register a new repository with local path
   */
  async registerRepository(
    name: string,
    path: string,
    remoteUrl?: string,
  ): Promise<AlexandriaEntry> {
    // If no remote URL provided, try to get it from git
    if (!remoteUrl) {
      try {
        const remotes = await gitClientFactory.getRemotes(path);
        const originRemote = remotes.find((r) => r.name === 'origin');
        remoteUrl = originRemote?.url;
      } catch (error) {
        console.log('[registerRepository] Could not get remote URL from git:', error);
      }
    }

    // Register with optional remote URL
    await this.outpostManager.registerRepository(name, path, remoteUrl);

    // Fetch and update GitHub metadata if it's a GitHub repo
    if (remoteUrl && remoteUrl.includes('github.com')) {
      const githubMetadata = await this.fetchGitHubMetadata(path, remoteUrl);
      if (githubMetadata) {
        try {
          // Use the new updateGitHubMetadata method from Alexandria
          await this.outpostManager.updateGitHubMetadata(name, githubMetadata);
          console.log('[registerRepository] Updated GitHub metadata for:', name);
        } catch (error) {
          console.error('[registerRepository] Failed to update GitHub metadata:', error);
        }
      }
    }

    // Return the updated entry
    const entry = this.outpostManager
      .getAllEntries()
      .find((e) => e.name === name);
    if (!entry) {
      throw new Error(`Failed to get entry after registration for ${name}`);
    }
    return entry;
  }

  /**
   * Add a repository from a remote URL (for UI compatibility)
   * This will register it without a local path initially
   */
  async addRepository(params: {
    name: string;
    remoteUrl?: string;
    localPath?: string;
    description?: string;
  }): Promise<AlexandriaEntry> {
    // If we have a local path, register it properly
    if (params.localPath) {
      return this.registerRepository(
        params.name,
        params.localPath,
        params.remoteUrl,
      );
    }

    // Otherwise, we need to handle remote-only repos differently
    // For now, throw an error since AlexandriaOutpostManager requires a local path
    throw new Error(
      'Remote-only repositories are not yet supported. Please provide a local path.',
    );
  }

  /**
   * Remove a repository by name
   * @param name - Repository name to remove
   * @param deleteLocal - Whether to delete local files (optional)
   * @returns Promise<boolean> indicating success
   */
  async removeRepository(name: string, deleteLocal = false): Promise<boolean> {
    try {
      // Get the repository details before removal
      const repository = await this.getRepository(name);
      if (!repository) {
        console.warn(`Repository not found: ${name}`);
        return false;
      }

      // Access the private projectRegistry field via reflection
      // This is a workaround until AlexandriaOutpostManager exposes removal
      const registryField = (this.outpostManager as any).projectRegistry;
      if (!registryField || typeof registryField.removeProject !== 'function') {
        console.error('Cannot access project registry for removal');
        return false;
      }

      // Remove from registry
      const removed = registryField.removeProject(name);

      if (!removed) {
        console.warn(`Failed to remove repository from registry: ${name}`);
        return false;
      }

      // Optionally delete local files
      if (deleteLocal && repository.path) {
        try {
          await FileSystemService.deleteDirectory(repository.path);
          console.log(`Deleted local files for repository: ${name} at ${repository.path}`);
        } catch (error) {
          console.error(`Failed to delete local files for ${name}:`, error);
          // Continue even if deletion fails - registry removal succeeded
        }
      }

      console.log(`Repository removed from registry: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error removing repository ${name}:`, error);
      return false;
    }
  }

  /**
   * Get total repository count
   */
  async getRepositoryCount(): Promise<number> {
    return this.outpostManager.getRepositoryCount();
  }

  /**
   * Search repositories by name or description
   */
  async searchRepositories(query: string): Promise<AlexandriaEntry[]> {
    const all = await this.getRepositories();
    const lowerQuery = query.toLowerCase();

    return all.filter(
      (repo) =>
        repo.name.toLowerCase().includes(lowerQuery) ||
        repo.github?.description?.toLowerCase().includes(lowerQuery) ||
        repo.github?.topics?.some((t) => t.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * Get repositories with views
   */
  async getRepositoriesWithViews(): Promise<AlexandriaEntry[]> {
    const all = await this.getRepositories();
    return all.filter((r) => r.hasViews);
  }

  /**
   * Refresh repository metadata (re-scan for views and update git info)
   */
  async refreshRepository(name: string): Promise<AlexandriaEntry | null> {
    // Get the repository to find its path
    const entries = this.outpostManager.getAllEntries();
    const repo = entries.find((e) => e.name === name);
    if (!repo) return null;

    try {
      // Update GitHub metadata using git CLI fallback
      if (!repo.github?.owner || repo.github.owner === 'local') {
        const githubMetadata = await this.fetchGitHubMetadata(repo.path, repo.remoteUrl);
        if (githubMetadata) {
          try {
            await this.outpostManager.updateGitHubMetadata(name, githubMetadata);
            console.log('[refreshRepository] Updated GitHub metadata for:', name);
          } catch (error) {
            console.error('[refreshRepository] Failed to update GitHub metadata:', error);
          }
        }
      }

      // Get the updated entry
      const updatedEntry = this.outpostManager
        .getAllEntries()
        .find((e) => e.name === name);

      if (!updatedEntry) return repo;

      // Get latest commit info from git
      const commitInfo = await gitClientFactory.getLastCommitInfo(repo.path);

      if (commitInfo) {
        // Return enriched entry with updated git info
        return {
          ...updatedEntry,
          github: {
            ...updatedEntry.github,
            lastCommit: commitInfo.date,
          },
          // Additional commit details (not part of GithubRepository type)
          lastCommitMessage: commitInfo.message,
          lastCommitAuthor: commitInfo.author,
          lastCommitHash: commitInfo.shortHash || commitInfo.hash,
        } as AlexandriaEntry;
      }

      return updatedEntry;
    } catch (error) {
      console.error('[refreshRepository] Error refreshing repository:', error);
    }

    // Return original repo if refresh fails
    return repo;
  }

  /**
   * Get all markdown document paths for a repository
   * These are the overview documents associated with CodebaseViews
   * @param name - Repository name
   * @returns Array of markdown document paths relative to repository root
   */
  async getRepositoryDocuments(name: string): Promise<string[]> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    const docs = await this.outpostManager.getAlexandriaEntryDocs(entry);

    // TODO: Remove deduplication once Alexandria library is fixed to not return duplicates
    // Temporary fix: deduplicate documents array
    return Array.from(new Set(docs));
  }

  /**
   * Get all markdown document paths for a repository by path
   * @param path - Repository path
   * @returns Array of markdown document paths relative to repository root
   */
  async getRepositoryDocumentsByPath(path: string): Promise<string[]> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    return this.outpostManager.getAlexandriaEntryDocs(entry);
  }

  /**
   * Get excluded document files from Alexandria configuration
   * These are markdown files that should not be tracked or indexed
   * @param name - Repository name
   * @returns Array of excluded file paths
   */
  async getExcludedDocuments(name: string): Promise<string[]> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    return this.outpostManager.getAlexandriaEntryExcludedDocs(entry);
  }

  /**
   * Get all markdown documents for a repository with exclusions applied
   * @param name - Repository name
   * @returns Object with documents and excluded paths
   */
  async getRepositoryDocumentsWithExclusions(name: string): Promise<{
    documents: string[];
    excluded: string[];
  }> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    // Get ALL markdown documents in the repository (respecting .gitignore)
    const allDocuments = await this.outpostManager.getAllDocs(entry, true);

    // Get documents that are excluded from tracking requirements
    // These are still valid documents but don't need to be associated with views
    const excluded = this.outpostManager.getAlexandriaEntryExcludedDocs(entry);

    // TODO: Remove deduplication once Alexandria library is fixed to not return duplicates
    // Temporary fix: deduplicate documents array
    const uniqueDocuments = Array.from(new Set(allDocuments));

    // For search indexing, we want to index ALL documents including excluded ones
    // The excluded list is returned for informational purposes only
    return {
      documents: uniqueDocuments,
      excluded,
    };
  }

  /**
   * Get all repositories with their document information
   * Useful for batch processing and indexing
   */
  async getRepositoriesWithDocuments(): Promise<
    Array<{
      entry: AlexandriaEntry;
      documents: string[];
      excluded: string[];
    }>
  > {
    const entries = await this.getRepositories();
    const results = [];

    for (const entry of entries) {
      try {
        const documents =
          await this.outpostManager.getAlexandriaEntryDocs(entry);
        const excluded =
          this.outpostManager.getAlexandriaEntryExcludedDocs(entry);

        results.push({
          entry,
          documents,
          excluded,
        });
      } catch (error) {
        console.warn(
          `Failed to get documents for repository ${entry.name}:`,
          error,
        );
        // Continue with empty documents for this repo
        results.push({
          entry,
          documents: [],
          excluded: [],
        });
      }
    }

    return results;
  }

  /**
   * Get all markdown files in a repository (tracked and untracked)
   * @param name - Repository name
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Array of all markdown file paths
   */
  async getAllMarkdownDocuments(name: string, useGitignore = true): Promise<string[]> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    return this.outpostManager.getAllDocs(entry, useGitignore);
  }

  /**
   * Get all markdown files by repository path
   * @param path - Repository path
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Array of all markdown file paths
   */
  async getAllMarkdownDocumentsByPath(path: string, useGitignore = true): Promise<string[]> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    return this.outpostManager.getAllDocs(entry, useGitignore);
  }

  /**
   * Refresh GitHub metadata for all repositories that don't have it or show as 'local'
   * This is useful for fixing repositories that were added before GitHub metadata fetching was implemented
   */
  async refreshAllGitHubMetadata(): Promise<void> {
    const entries = this.outpostManager.getAllEntries();

    for (const entry of entries) {
      // Check if GitHub metadata is missing or shows as 'local'
      if (!entry.github?.owner || entry.github.owner === 'local' || entry.github.owner === 'unknown') {
        console.log(`[refreshAllGitHubMetadata] Refreshing metadata for: ${entry.name}`);

        try {
          const githubMetadata = await this.fetchGitHubMetadata(entry.path, entry.remoteUrl);
          if (githubMetadata) {
            await this.outpostManager.updateGitHubMetadata(entry.name, githubMetadata);
            console.log(`[refreshAllGitHubMetadata] Updated GitHub metadata for: ${entry.name}`);
          }
        } catch (error) {
          console.error(`[refreshAllGitHubMetadata] Failed to update ${entry.name}:`, error);
        }
      }
    }

    console.log('[refreshAllGitHubMetadata] Finished refreshing GitHub metadata');
  }

  /**
   * Get untracked markdown documents in a repository
   * These are markdown files not associated with any CodebaseView
   * @param name - Repository name
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Array of untracked markdown file paths
   */
  async getUntrackedDocuments(name: string, useGitignore = true): Promise<string[]> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    return this.outpostManager.getUntrackedDocs(entry, useGitignore);
  }

  /**
   * Get untracked markdown documents by repository path
   * @param path - Repository path
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Array of untracked markdown file paths
   */
  async getUntrackedDocumentsByPath(path: string, useGitignore = true): Promise<string[]> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    return this.outpostManager.getUntrackedDocs(entry, useGitignore);
  }

  /**
   * Get comprehensive document information for a repository
   * Returns tracked, untracked, and excluded documents
   * @param name - Repository name
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Object with categorized document arrays
   */
  async getComprehensiveDocuments(name: string, useGitignore = true): Promise<{
    tracked: string[];
    untracked: string[];
    excluded: string[];
    all: string[];
  }> {
    const entry = await this.getRepository(name);
    if (!entry) {
      throw new Error(`Repository not found: ${name}`);
    }

    const [tracked, untracked, excluded, all] = await Promise.all([
      this.outpostManager.getAlexandriaEntryDocs(entry),
      this.outpostManager.getUntrackedDocs(entry, useGitignore),
      Promise.resolve(this.outpostManager.getAlexandriaEntryExcludedDocs(entry)),
      this.outpostManager.getAllDocs(entry, useGitignore),
    ]);

    return {
      tracked,
      untracked,
      excluded,
      all,
    };
  }
}
