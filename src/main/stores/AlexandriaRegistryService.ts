/**
 * AlexandriaRegistryService - Service for managing Alexandria repositories
 * Uses AlexandriaOutpostManager from @principal-ai/alexandria-core-library for local repository management
 */

import {
  AlexandriaOutpostManager,
  MemoryPalace,
} from '@principal-ai/alexandria-core-library';
import {
  NodeFileSystemAdapter,
  NodeGlobAdapter,
} from '@principal-ai/alexandria-core-library/node';
import type {
  AlexandriaEntry,
  CodebaseView,
  Purl,
  Workspace,
  WorkspaceMembership,
} from '@principal-ai/alexandria-core-library';
import { gitClientFactory } from '../utils/gitClientFactory';
import { FileSystemService } from '../file-system-service';
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
    const globAdapter = new NodeGlobAdapter();
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
   * Get repository by local path. Path is the canonical key — every clone has
   * a unique path, but `name` is a display label that can collide (forks).
   */
  async getRepositoryByPath(path: string): Promise<AlexandriaEntry | null> {
    return this.outpostManager.getRepositoryByPath(path);
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
   * Register a new repository at `path`. The library derives the display name
   * from the remote URL (`owner/repo` for GitHub) — callers no longer pass it.
   */
  async registerRepository(
    path: string,
    remoteUrl?: string,
  ): Promise<AlexandriaEntry> {
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

    let registered = await this.outpostManager.registerRepository(
      path,
      remoteUrl,
    );

    // Backfill: if the entry already existed without a remoteUrl (or with a
    // different one) and we successfully derived one this time, update it.
    // ProjectRegistryStore.registerProject is a no-op for existing paths, so
    // without this stale entries would never pick up a freshly-set origin.
    if (remoteUrl && registered.remoteUrl !== remoteUrl) {
      try {
        registered = await this.outpostManager.updateRepository(path, {
          remoteUrl,
        });
      } catch (error) {
        console.error(
          '[registerRepository] Failed to backfill remoteUrl:',
          error,
        );
      }
    }

    if (remoteUrl && remoteUrl.includes('github.com')) {
      const githubMetadata = await this.fetchGitHubMetadata(remoteUrl);
      if (githubMetadata) {
        try {
          return await this.outpostManager.updateGitHubMetadata(
            path,
            githubMetadata,
          );
        } catch (error) {
          console.error(
            '[registerRepository] Failed to update GitHub metadata:',
            error,
          );
        }
      }
    }

    return registered;
  }

  /**
   * Remove a repository at `path` from the registry.
   * @param path - Repository local path
   * @param deleteLocal - Whether to delete local files as well
   */
  async removeRepository(path: string, deleteLocal = false): Promise<boolean> {
    try {
      const repository = await this.getRepositoryByPath(path);
      if (!repository) {
        console.warn(`Repository not found at path: ${path}`);
        return false;
      }

      const removed = this.outpostManager.removeRepository(path);

      if (!removed) {
        console.warn(`Failed to remove repository at path: ${path}`);
        return false;
      }

      if (deleteLocal) {
        try {
          await FileSystemService.deleteDirectory(path);
          console.log(`Deleted local files for repository at ${path}`);
        } catch (error) {
          console.error(`Failed to delete local files at ${path}:`, error);
        }
      }

      console.log(`Repository removed from registry: ${path}`);
      return true;
    } catch (error) {
      console.error(`Error removing repository at ${path}:`, error);
      return false;
    }
  }

  /**
   * Update repository metadata, keyed on path.
   */
  async updateRepository(
    path: string,
    updates: Partial<Omit<AlexandriaEntry, 'path' | 'registeredAt'>>,
  ): Promise<AlexandriaEntry> {
    return this.outpostManager.updateRepository(
      path,
      updates,
    ) as Promise<AlexandriaEntry>;
  }

  /**
   * Update the lastOpenedAt timestamp for the repository at `path`.
   */
  async updateLastOpened(path: string): Promise<void> {
    const tracer = getTracer('principal-ade-main');
    const span = tracer.startSpan('alexandria.registry.timestamp_updated');
    const timestamp = new Date().toISOString();

    span.setAttributes({
      repository_path: path,
      timestamp,
    });

    try {
      await this.outpostManager.updateRepository(path, {
        lastOpenedAt: timestamp,
      });

      span.addEvent('alexandria.outpost.repository_updated', {
        repository_path: path,
        field_updated: 'lastOpenedAt',
      });

      span.addEvent('alexandria.storage.metadata_persisted', {
        repository_path: path,
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
   * Refresh repository metadata (re-scan for views and update git info), keyed on path.
   */
  async refreshRepository(path: string): Promise<AlexandriaEntry | null> {
    const repo = await this.getRepositoryByPath(path);
    if (!repo) return null;

    try {
      const githubMetadata = await this.fetchGitHubMetadata(repo.remoteUrl);
      console.log(
        '[refreshRepository] Fetched GitHub metadata:',
        githubMetadata,
      );
      if (githubMetadata) {
        try {
          await this.outpostManager.updateGitHubMetadata(path, githubMetadata);
          console.log('[refreshRepository] Updated GitHub metadata for:', path);
        } catch (error) {
          console.error(
            '[refreshRepository] Failed to update GitHub metadata:',
            error,
          );
        }
      }

      const updatedEntry = await this.getRepositoryByPath(path);

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
   * Get all markdown document paths for a repository at `path`.
   */
  async getRepositoryDocuments(path: string): Promise<string[]> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    return this.outpostManager.getAlexandriaEntryDocs(entry);
  }

  /**
   * Get excluded document files from Alexandria configuration for the
   * repository at `path`.
   */
  async getExcludedDocuments(path: string): Promise<string[]> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    return this.outpostManager.getAlexandriaEntryExcludedDocs(entry);
  }

  /**
   * Get all markdown documents for the repository at `path` with exclusions applied.
   */
  async getRepositoryDocumentsWithExclusions(path: string): Promise<{
    documents: string[];
    excluded: string[];
  }> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
    }

    const allDocuments = await this.outpostManager.getAllDocs(entry, true);
    const excluded = this.outpostManager.getAlexandriaEntryExcludedDocs(entry);

    return {
      documents: allDocuments,
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
   * Get all markdown files in the repository at `path` (tracked and untracked).
   */
  async getAllMarkdownDocuments(
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
   * Get untracked markdown documents in the repository at `path`.
   */
  async getUntrackedDocuments(
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
   * Get tracked, untracked, and excluded documents for the repository at `path`.
   */
  async getComprehensiveDocuments(
    path: string,
    useGitignore = true,
  ): Promise<{
    tracked: string[];
    untracked: string[];
    excluded: string[];
    all: string[];
  }> {
    const entry = await this.getRepositoryByPath(path);
    if (!entry) {
      throw new Error(`Repository not found at path: ${path}`);
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
    repository: AlexandriaEntry | Purl,
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
    repository: AlexandriaEntry | Purl,
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
    repository: AlexandriaEntry | Purl,
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
      this.outpostManager.getProjectRegistry(),
    );
  }

  /**
   * Check if a repository is in a workspace
   */
  async isRepositoryInWorkspace(
    repository: AlexandriaEntry | Purl,
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

  // ===== Data Management Methods =====

  /**
   * Clear all Alexandria data (repositories and workspaces) for clean uninstall
   * WARNING: This will permanently delete all registered repositories and workspaces
   * This does NOT delete local repository files, only the registry data
   * @returns Object with counts of removed items
   */
  async clearAllData(): Promise<{
    repositoriesRemoved: number;
    workspacesRemoved: number;
  }> {
    return this.outpostManager.clearAllData();
  }
}
