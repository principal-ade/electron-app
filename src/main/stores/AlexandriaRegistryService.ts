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

export class AlexandriaRegistryService {
  private static instance: AlexandriaRegistryService;
  private outpostManager: AlexandriaOutpostManager;
  private initialized = false;

  private constructor() {
    // Create filesystem adapter and outpost manager
    const fsAdapter = new NodeFileSystemAdapter();
    this.outpostManager = new AlexandriaOutpostManager(fsAdapter);
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
            // Update the github field with last commit date and details
            const enrichedEntry = {
              ...entry,
              github: {
                ...entry.github,
                lastCommit: commitInfo.date, // ISO date string from git
                lastCommitMessage: commitInfo.message,
                lastCommitAuthor: commitInfo.author,
                lastCommitHash: commitInfo.shortHash || commitInfo.hash,
              },
            };
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
            lastCommitMessage: commitInfo.message,
            lastCommitAuthor: commitInfo.author,
            lastCommitHash: commitInfo.shortHash || commitInfo.hash,
          },
        };
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
            lastCommitMessage: commitInfo.message,
            lastCommitAuthor: commitInfo.author,
            lastCommitHash: commitInfo.shortHash || commitInfo.hash,
          },
        };
      }
    } catch (error) {
      // Silently continue if git info fails
    }

    return entry;
  }

  /**
   * Register a new repository with local path
   */
  async registerRepository(
    name: string,
    path: string,
    remoteUrl?: string,
  ): Promise<AlexandriaEntry> {
    // Register with optional remote URL
    await this.outpostManager.registerRepository(name, path, remoteUrl);
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
   */
  async removeRepository(name: string): Promise<boolean> {
    // AlexandriaOutpostManager doesn't have a remove method yet
    // We'll need to request this feature or implement it differently
    console.warn(
      'Repository removal not yet implemented in AlexandriaOutpostManager',
    );
    return false;
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
      // Get latest commit info from git
      const commitInfo = await gitClientFactory.getLastCommitInfo(repo.path);

      if (commitInfo) {
        // Return enriched entry with updated git info
        return {
          ...repo,
          github: {
            ...repo.github,
            lastCommit: commitInfo.date,
            lastCommitMessage: commitInfo.message,
            lastCommitAuthor: commitInfo.author,
            lastCommitHash: commitInfo.shortHash || commitInfo.hash,
          },
        };
      }
    } catch (error) {
      // Silently continue if git info fails
    }

    // Return original repo if git info fails
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

    const documents = await this.outpostManager.getAlexandriaEntryDocs(entry);
    const excluded = this.outpostManager.getAlexandriaEntryExcludedDocs(entry);

    // TODO: Remove deduplication once Alexandria library is fixed to not return duplicates
    // Temporary fix: deduplicate documents array
    const uniqueDocuments = Array.from(new Set(documents));

    // Filter out excluded documents
    const filteredDocuments = uniqueDocuments.filter(
      (doc) => !excluded.includes(doc),
    );

    return {
      documents: filteredDocuments,
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
}
