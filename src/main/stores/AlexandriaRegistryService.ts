/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @a24z/core-library for local repository management
 */

import {
  AlexandriaOutpostManager,
  NodeFileSystemAdapter,
} from '@a24z/core-library';
import type { AlexandriaEntry } from '@a24z/core-library';

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
   * Get all repositories with path information
   */
  async getRepositories(): Promise<AlexandriaEntry[]> {
    // Use getAllEntries to get repositories with path information
    return this.outpostManager.getAllEntries();
  }

  /**
   * Get repository by name
   */
  async getRepository(name: string): Promise<AlexandriaEntry | null> {
    // Get all entries and find by name
    const entries = this.outpostManager.getAllEntries();
    return entries.find((e) => e.name === name) || null;
  }

  /**
   * Get repository by local path
   */
  async getRepositoryByPath(path: string): Promise<AlexandriaEntry | null> {
    // Get all entries and find by path
    const entries = this.outpostManager.getAllEntries();
    return entries.find((e) => e.path === path) || null;
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
   * Refresh repository metadata (re-scan for views)
   */
  async refreshRepository(name: string): Promise<AlexandriaEntry | null> {
    // Get the repository to find its path
    const repo = await this.getRepository(name);
    if (!repo) return null;

    // For now, just return the repo as-is
    // AlexandriaOutpostManager should handle refreshing internally
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
