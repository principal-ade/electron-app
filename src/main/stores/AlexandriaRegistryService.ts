/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @principal-ai/alexandria-core-library for local repository management
 */

import {
  AlexandriaOutpostManager,
  MemoryPalace,
} from '@principal-ai/alexandria-core-library';
import { NodeFileSystemAdapter } from '@principal-ai/alexandria-core-library/node';
import type {
  AlexandriaEntry,
  CodebaseView,
  Workspace,
  WorkspaceMembership,
} from '@principal-ai/alexandria-core-library';
import { gitClientFactory } from '../utils/gitClientFactory';
import { FileSystemService } from '../file-system-service';
import { LocalNodeGlobAdapter } from '../adapters/LocalNodeGlobAdapter';
import { homedir } from 'os';
import { getTracer } from '../telemetry';
import { SpanStatusCode } from '@opentelemetry/api';

export class AlexandriaRegistryService {
  private static instance: AlexandriaRegistryService;
  private outpostManager: AlexandriaOutpostManager;
  private initialized = false;

  private constructor() {
    // Create filesystem and glob adapters for outpost manager
    const fsAdapter = new NodeFileSystemAdapter();
    const globAdapter = new LocalNodeGlobAdapter(); // Use our local fixed adapter
    const homeDir = homedir(); // Get user's home directory
    this.outpostManager = new AlexandriaOutpostManager(
      fsAdapter,
      globAdapter,
      homeDir,
    );
  }

  static getInstance(): AlexandriaRegistryService {
    if (!AlexandriaRegistryService.instance) {
      AlexandriaRegistryService.instance = new AlexandriaRegistryService();
    }
    return AlexandriaRegistryService.instance;
  }

  /**
   * Get all repositories with path information
   * Repository metadata including github.lastCommit is already stored in the registry
   */
  async getRepositories(): Promise<AlexandriaEntry[]> {
    return this.outpostManager.getAllEntries() || [];
  }

  /**
   * Get repository by name
   */
  async getRepository(name: string): Promise<AlexandriaEntry | null> {
    const entries = this.outpostManager.getAllEntries();
    return entries.find((e) => e.name === name) || null;
  }

  /**
   * Get repository by local path
   */
  async getRepositoryByPath(path: string): Promise<AlexandriaEntry | null> {
    const entries = this.outpostManager.getAllEntries();
    return entries.find((e) => e.path === path) || null;
  }

  /**
   * Fetch GitHub metadata for a repository from GitHub API
   * Falls back to parsing owner/repo from URL for private repos
   */
  private async fetchGitHubMetadata(remoteUrl?: string): Promise<{
    owner?: string;
    name?: string;
    description?: string;
    language?: string;
    stars?: number;
    defaultBranch?: string;
    topics?: string[];
    isPublic?: boolean;
  } | null> {
    if (!remoteUrl) {
      return null;
    }

    // Check if it's a GitHub URL
    if (!remoteUrl.includes('github.com')) {
      return null;
    }

    // Extract owner and repo from URL
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

    const [, owner, repoName] = match;

    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'PrincipalADE-Electron',
        },
      });

      if (response.status === 404) {
        // Repository is private or doesn't exist - return parsed info
        return {
          owner,
          name: repoName,
          isPublic: false,
        };
      }

      if (!response.ok) {
        // API failed - return basic info from parsed URL
        return {
          owner,
          name: repoName,
        };
      }

      const data = (await response.json()) as {
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
        isPublic: data.private === false,
      };
    } catch (error) {
      console.error('[fetchGitHubMetadata] Error fetching metadata:', error);
      // Return basic info parsed from URL
      return {
        owner,
        name: repoName,
      };
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
        console.log(
          '[registerRepository] Could not get remote URL from git:',
          error,
        );
      }
    }

    // Register with optional remote URL (new API: path, remoteUrl, customName)
    await this.outpostManager.registerRepository(path, remoteUrl, name);

    // Fetch and update GitHub metadata if it's a GitHub repo
    if (remoteUrl && remoteUrl.includes('github.com')) {
      const githubMetadata = await this.fetchGitHubMetadata(remoteUrl);
      if (githubMetadata) {
        try {
          // Use the new updateGitHubMetadata method from Alexandria
          await this.outpostManager.updateGitHubMetadata(name, githubMetadata);
          console.log(
            '[registerRepository] Updated GitHub metadata for:',
            name,
          );
        } catch (error) {
          console.error(
            '[registerRepository] Failed to update GitHub metadata:',
            error,
          );
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          console.log(
            `Deleted local files for repository: ${name} at ${repository.path}`,
          );
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
   * Update repository metadata
   * @param name - Repository name
   * @param updates - Partial updates to apply
   * @returns Updated repository entry
   */
  async updateRepository(
    name: string,
    updates: Partial<Omit<AlexandriaEntry, 'name' | 'registeredAt'>>,
  ): Promise<AlexandriaEntry> {
    return this.outpostManager.updateRepository(name, updates);
  }

  /**
   * Update the lastOpenedAt timestamp for a repository
   * @param name - Repository name
   */
  async updateLastOpened(name: string): Promise<void> {
    const tracer = getTracer('alexandria-recently-opened');
    const span = tracer.startSpan('alexandria.registry.timestamp_updated');
    const timestamp = new Date().toISOString();

    span.setAttributes({
      repository_name: name,
      timestamp,
    });

    try {
      await this.outpostManager.updateRepository(name, {
        lastOpenedAt: timestamp,
      });

      span.addEvent('alexandria.outpost.repository_updated', {
        repository_name: name,
        field_updated: 'lastOpenedAt',
      });

      span.addEvent('alexandria.storage.metadata_persisted', {
        repository_name: name,
      });

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
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
      // Always fetch and update GitHub metadata when explicitly refreshing
      const githubMetadata = await this.fetchGitHubMetadata(repo.remoteUrl);
      console.log(
        '[refreshRepository] Fetched GitHub metadata:',
        githubMetadata,
      );
      if (githubMetadata) {
        try {
          await this.outpostManager.updateGitHubMetadata(name, githubMetadata);
          console.log('[refreshRepository] Updated GitHub metadata for:', name);

          // Verify the update was persisted
          const verifyEntry = this.outpostManager
            .getAllEntries()
            .find((e) => e.name === name);
          console.log('[refreshRepository] Verified entry after update:', {
            name: verifyEntry?.name,
            description: verifyEntry?.github?.description,
          });
        } catch (error) {
          console.error(
            '[refreshRepository] Failed to update GitHub metadata:',
            error,
          );
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
  async getAllMarkdownDocuments(
    name: string,
    useGitignore = true,
  ): Promise<string[]> {
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
  async getAllMarkdownDocumentsByPath(
    path: string,
    useGitignore = true,
  ): Promise<string[]> {
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
      if (
        !entry.github?.owner ||
        entry.github.owner === 'local' ||
        entry.github.owner === 'unknown'
      ) {
        console.log(
          `[refreshAllGitHubMetadata] Refreshing metadata for: ${entry.name}`,
        );

        try {
          const githubMetadata = await this.fetchGitHubMetadata(
            entry.remoteUrl,
          );
          if (githubMetadata) {
            await this.outpostManager.updateGitHubMetadata(
              entry.name,
              githubMetadata,
            );
            console.log(
              `[refreshAllGitHubMetadata] Updated GitHub metadata for: ${entry.name}`,
            );
          }
        } catch (error) {
          console.error(
            `[refreshAllGitHubMetadata] Failed to update ${entry.name}:`,
            error,
          );
        }
      }
    }

    console.log(
      '[refreshAllGitHubMetadata] Finished refreshing GitHub metadata',
    );
  }

  /**
   * Get untracked markdown documents in a repository
   * These are markdown files not associated with any CodebaseView
   * @param name - Repository name
   * @param useGitignore - Whether to respect .gitignore files (default: true)
   * @returns Array of untracked markdown file paths
   */
  async getUntrackedDocuments(
    name: string,
    useGitignore = true,
  ): Promise<string[]> {
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
  async getUntrackedDocumentsByPath(
    path: string,
    useGitignore = true,
  ): Promise<string[]> {
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
  async getComprehensiveDocuments(
    name: string,
    useGitignore = true,
  ): Promise<{
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
      Promise.resolve(
        this.outpostManager.getAlexandriaEntryExcludedDocs(entry),
      ),
      this.outpostManager.getAllDocs(entry, useGitignore),
    ]);

    return {
      tracked,
      untracked,
      excluded,
      all,
    };
  }

  /**
   * Get all CodebaseViews for a repository using MemoryPalace
   * @param repositoryPath - Local path to the repository
   * @returns Array of CodebaseView configurations
   */
  async getCodebaseViews(repositoryPath: string): Promise<CodebaseView[]> {
    try {
      const fsAdapter = new NodeFileSystemAdapter();
      const memoryPalace = new MemoryPalace(repositoryPath, fsAdapter);
      return memoryPalace.listViews();
    } catch (error) {
      console.error(
        `[getCodebaseViews] Error loading views for ${repositoryPath}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Get a specific CodebaseView by ID using MemoryPalace
   * @param repositoryPath - Local path to the repository
   * @param viewId - ID of the view to retrieve
   * @returns CodebaseView configuration or null if not found
   */
  async getCodebaseView(
    repositoryPath: string,
    viewId: string,
  ): Promise<CodebaseView | null> {
    try {
      const fsAdapter = new NodeFileSystemAdapter();
      const memoryPalace = new MemoryPalace(repositoryPath, fsAdapter);
      return memoryPalace.getView(viewId);
    } catch (error) {
      console.error(
        `[getCodebaseView] Error loading view ${viewId} for ${repositoryPath}:`,
        error,
      );
      return null;
    }
  }

  // ===== Workspace CRUD Methods =====

  /**
   * Create a new workspace
   */
  async createWorkspace(
    workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Workspace> {
    return this.outpostManager.workspaces.createWorkspace(workspace);
  }

  /**
   * Get a specific workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.outpostManager.workspaces.getWorkspace(id);
  }

  /**
   * Get all workspaces
   */
  async getWorkspaces(): Promise<Workspace[]> {
    return this.outpostManager.workspaces.getWorkspaces();
  }

  /**
   * Update an existing workspace
   */
  async updateWorkspace(
    id: string,
    updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>,
  ): Promise<Workspace> {
    return this.outpostManager.workspaces.updateWorkspace(id, updates);
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(id: string): Promise<boolean> {
    return this.outpostManager.workspaces.deleteWorkspace(id);
  }

  // ===== Workspace Membership Management =====

  /**
   * Add a repository to a workspace
   */
  async addRepositoryToWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return this.outpostManager.workspaces.addRepositoryToWorkspace(
      repository,
      workspaceId,
      metadata,
    );
  }

  /**
   * Remove a repository from a workspace
   */
  async removeRepositoryFromWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
  ): Promise<void> {
    return this.outpostManager.workspaces.removeRepositoryFromWorkspace(
      repository,
      workspaceId,
    );
  }

  /**
   * Get all memberships for a workspace
   */
  async getWorkspaceMemberships(
    workspaceId: string,
  ): Promise<WorkspaceMembership[]> {
    return this.outpostManager.workspaces.getWorkspaceMemberships(workspaceId);
  }

  /**
   * Get all workspaces that contain a specific repository
   */
  async getRepositoryWorkspaces(
    repository: AlexandriaEntry | string,
  ): Promise<Workspace[]> {
    return this.outpostManager.workspaces.getRepositoryWorkspaces(repository);
  }

  // ===== Workspace Query Methods =====

  /**
   * Get all repositories in a workspace
   */
  async getRepositoriesInWorkspace(
    workspaceId: string,
  ): Promise<AlexandriaEntry[]> {
    return this.outpostManager.workspaces.getRepositoriesInWorkspace(
      workspaceId,
      this.outpostManager['projectRegistry'], // Access internal projectRegistry
    );
  }

  /**
   * Check if a repository is in a workspace
   */
  async isRepositoryInWorkspace(
    repository: AlexandriaEntry | string,
    workspaceId: string,
  ): Promise<boolean> {
    return this.outpostManager.workspaces.isRepositoryInWorkspace(
      repository,
      workspaceId,
    );
  }

  // ===== Default Workspace Methods =====

  /**
   * Get the default workspace
   */
  async getDefaultWorkspace(): Promise<Workspace | null> {
    return this.outpostManager.workspaces.getDefaultWorkspace();
  }

  /**
   * Set the default workspace
   */
  async setDefaultWorkspace(workspaceId: string): Promise<void> {
    return this.outpostManager.workspaces.setDefaultWorkspace(workspaceId);
  }
}
