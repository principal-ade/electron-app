import { parseGitHubUrl } from '../../shared/utils/githubUrlParser';
import {
  PackageLayerModule,
  PackageLayer,
  FileSystemTree,
} from '@principal-ai/codebase-composition';

import type { Repository } from '../../shared/types/repository.types';
import type {
  FileTreeSource,
  LoadedFileTreeSource,
} from '../types/file-tree-source';
import {
  createFileTreeSource,
  compareFileTreeSources,
  isTemporarySource,
} from '../types/file-tree-source';

import { CloneVisibilityService } from './CloneVisibilityService';
import { ElectronPlatformAdapters } from '../adapters';
import { GitHubWebAdapters } from '../adapters/GitHubWebAdapters';

/**
 * Service for managing file tree sources
 * Handles converting repository info to sources and managing source state
 *
 * NOTE: This service is deprecated and only kept for RepositoryCityVisualization.
 * New code should use RepositoryDataCache with useRepositoryData hook instead.
 */
export class FileTreeSourceService {
  private sources: Map<string, FileTreeSource> = new Map();
  private activeSourceId: string | null = null;
  private packageModule: PackageLayerModule;

  constructor() {
    this.packageModule = new PackageLayerModule();
  }

  /**
   * Initialize sources from a repository
   * Creates only the visible clone source to optimize loading
   */
  initializeFromRepository(
    repository: Repository,
    options?: { loadRemoteHead?: boolean },
  ): FileTreeSource[] {
    const sources: FileTreeSource[] = [];

    // Parse repository info
    const repoInfo = parseGitHubUrl(repository.remoteUrl);
    const owner = repoInfo?.owner || repository.owner;
    const repo = repoInfo?.repo || repository.name;

    if (!owner || !repo) {
      throw new Error('Repository must have owner and name');
    }

    // Only create source for the visible clone
    if (repository.localClones && repository.localClones.length > 0) {
      const visibleClonePath =
        CloneVisibilityService.getVisibleClonePath(repository);

      if (visibleClonePath) {
        const visibleClone = repository.localClones.find(
          (c) => c.path === visibleClonePath,
        );
        if (visibleClone) {
          const source = createFileTreeSource.localWorkingCopy(
            visibleClone.path,
            owner,
            repo,
            repository.remoteUrl,
            visibleClone.currentBranch,
          );
          // Ensure unique ID
          source.id = `local-${visibleClone.path}`;
          source.isDefault = true; // Visible clone is always default
          sources.push(source);
        }
      }
    }

    // Optionally create source for default remote branch (deferred by default)
    if (options?.loadRemoteHead) {
      const defaultBranch = repository.metadata?.defaultBranch || 'main';
      const remoteSource = createFileTreeSource.remoteBranch(
        owner,
        repo,
        repository.remoteUrl,
        defaultBranch,
      );
      remoteSource.isDefault = sources.length === 0; // Only default if no local clones
      sources.push(remoteSource);
    }

    // Store all sources
    sources.forEach((source) => {
      this.sources.set(source.id, source);
    });

    // Set active source (the visible clone or remote if no clones)
    const defaultSource = sources.find((s) => s.isDefault);
    if (defaultSource) {
      this.activeSourceId = defaultSource.id;
    }

    // Note: Prefetching removed - use RepositoryDataCache instead

    return sources;
  }

  /**
   * Add a new source
   */
  addSource(source: FileTreeSource): void {
    this.sources.set(source.id, source);

    // Note: Prefetching removed - use RepositoryDataCache instead
  }

  /**
   * Remove a source
   */
  removeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) {
      this.sources.delete(sourceId);

      // Note: Cache invalidation removed - use RepositoryDataCache instead

      // Switch to another source if active was removed
      if (this.activeSourceId === sourceId) {
        const remainingSources = this.getAllSources();
        this.activeSourceId = remainingSources[0]?.id || null;
      }
    }
  }

  /**
   * Get all sources
   */
  getAllSources(): FileTreeSource[] {
    return Array.from(this.sources.values()).sort(compareFileTreeSources);
  }

  /**
   * Get sources by type
   */
  getSourcesByType(type: 'local' | 'remote'): FileTreeSource[] {
    return this.getAllSources().filter((source) => source.type === type);
  }

  /**
   * Get temporary sources
   */
  getTemporarySources(): FileTreeSource[] {
    return this.getAllSources().filter(isTemporarySource);
  }

  /**
   * Get a specific source
   */
  getSource(sourceId: string): FileTreeSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Get active source
   */
  getActiveSource(): FileTreeSource | null {
    if (!this.activeSourceId) return null;
    return this.sources.get(this.activeSourceId) || null;
  }

  /**
   * Set active source
   */
  setActiveSource(sourceId: string): void {
    if (this.sources.has(sourceId)) {
      this.activeSourceId = sourceId;

      // Update lastAccessed
      const source = this.sources.get(sourceId);
      if (source) {
        source.lastAccessed = Date.now();
      }
    }
  }

  /**
   * Load a source's tree (uses cache)
   * @deprecated Use RepositoryDataCache with useRepositoryData hook instead
   */
  async loadSourceTree(sourceId: string): Promise<LoadedFileTreeSource | null> {
    throw new Error(
      'FileTreeSourceService.loadSourceTree is deprecated - use RepositoryDataCache instead',
    );
  }

  /**
   * Load file tree (alias for loadSourceTree)
   * @deprecated Use RepositoryDataCache with useRepositoryData hook instead
   */
  async loadFileTree(sourceId: string): Promise<LoadedFileTreeSource | null> {
    throw new Error(
      'FileTreeSourceService.loadFileTree is deprecated - use RepositoryDataCache instead',
    );
  }

  /**
   * Load the active source's tree
   * @deprecated Use RepositoryDataCache with useRepositoryData hook instead
   */
  async loadActiveSourceTree(): Promise<LoadedFileTreeSource | null> {
    throw new Error(
      'FileTreeSourceService.loadActiveSourceTree is deprecated - use RepositoryDataCache instead',
    );
  }

  /**
   * Detect packages in a source's file tree
   * Uses the standard PackageLayerModule for consistent package detection
   * @deprecated Use RepositoryMonitoringService.getPackages instead
   */
  async detectPackagesForSource(
    sourceId: string,
  ): Promise<PackageLayer[] | null> {
    throw new Error(
      'FileTreeSourceService.detectPackagesForSource is deprecated - use RepositoryMonitoringService.getPackages instead',
    );
  }

  /**
   * Core package detection logic using PackageLayerModule
   */
  private async detectPackages(
    fileTree: FileSystemTree,
    source: FileTreeSource,
  ): Promise<PackageLayer[]> {
    // Create adapters based on source type
    const adapters =
      source.type === 'remote'
        ? new GitHubWebAdapters(
            source.owner,
            source.name,
            source.metadata?.currentBranch || source.location,
          )
        : new ElectronPlatformAdapters();

    // Create a fileReader function for the package module
    const fileReader = async (filePath: string): Promise<string | null> => {
      try {
        const resolvedPath =
          source.type === 'local' && !filePath.startsWith('/')
            ? `${source.location}/${filePath.replace(/^\/+/, '')}`
            : filePath;

        const result = await adapters.fileSystem.readFile(resolvedPath);
        return result?.content || null;
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error);
        return null;
      }
    };

    // Discover packages
    return await this.packageModule.discoverPackages(fileTree, fileReader);
  }

  /**
   * Get cached packages for a source without loading
   * @deprecated Use RepositoryDataCache instead
   */
  getCachedPackages(sourceId: string): PackageLayer[] | null {
    return null;
  }

  /**
   * Load multiple source trees in parallel
   * @deprecated Use RepositoryDataCache instead
   */
  async loadSourceTrees(sourceIds: string[]): Promise<LoadedFileTreeSource[]> {
    throw new Error(
      'FileTreeSourceService.loadSourceTrees is deprecated - use RepositoryDataCache instead',
    );
  }

  /**
   * Create a new branch source
   */
  createBranchSource(
    branchName: string,
    makeActive: boolean = false,
  ): FileTreeSource | null {
    // Get any existing source to copy repository info from
    const existingSource = this.getActiveSource() || this.getAllSources()[0];
    if (!existingSource) return null;

    const newSource = createFileTreeSource.remoteBranch(
      existingSource.owner,
      existingSource.name,
      existingSource.remoteUrl,
      branchName,
    );

    // Ensure unique ID
    newSource.id = `remote-${branchName}-${Date.now()}`;

    this.addSource(newSource);

    if (makeActive) {
      this.setActiveSource(newSource.id);
    }

    return newSource;
  }

  /**
   * Create a new tag source
   */
  createTagSource(
    tagName: string,
    makeActive: boolean = false,
  ): FileTreeSource | null {
    const existingSource = this.getActiveSource() || this.getAllSources()[0];
    if (!existingSource) return null;

    const newSource = createFileTreeSource.remoteTag(
      existingSource.owner,
      existingSource.name,
      existingSource.remoteUrl,
      tagName,
    );

    // Ensure unique ID
    newSource.id = `remote-tag-${tagName}-${Date.now()}`;

    this.addSource(newSource);

    if (makeActive) {
      this.setActiveSource(newSource.id);
    }

    return newSource;
  }

  /**
   * Create a new commit source
   */
  createCommitSource(
    commitSha: string,
    makeActive: boolean = false,
  ): FileTreeSource | null {
    const existingSource = this.getActiveSource() || this.getAllSources()[0];
    if (!existingSource) return null;

    const newSource = createFileTreeSource.remoteCommit(
      existingSource.owner,
      existingSource.name,
      existingSource.remoteUrl,
      commitSha,
    );

    this.addSource(newSource);

    if (makeActive) {
      this.setActiveSource(newSource.id);
    }

    return newSource;
  }

  /**
   * Create a temporary source for experimentation
   */
  createTemporarySource(
    baseSourceId: string,
    location: string,
    locationType: 'branch' | 'tag' | 'commit',
  ): FileTreeSource | null {
    const baseSource = this.sources.get(baseSourceId);
    if (!baseSource) return null;

    const tempSource = createFileTreeSource.temporary(
      baseSource,
      location,
      locationType,
    );

    this.addSource(tempSource);
    return tempSource;
  }

  /**
   * Switch to a different clone and load its tree
   */
  async switchVisibleClone(
    repository: Repository,
    newClonePath: string,
  ): Promise<FileTreeSource | null> {
    // Update visibility preference
    CloneVisibilityService.setVisibleClonePath(
      repository.remoteUrl,
      newClonePath,
    );

    // Find the clone
    const clone = repository.localClones.find((c) => c.path === newClonePath);
    if (!clone) return null;

    // Parse repository info
    const repoInfo = parseGitHubUrl(repository.remoteUrl);
    const owner = repoInfo?.owner || repository.owner;
    const repo = repoInfo?.repo || repository.name;

    if (!owner || !repo) return null;

    // Check if source already exists
    const existingSourceId = `local-${newClonePath}`;
    let source = this.sources.get(existingSourceId);

    if (!source) {
      // Create new source for this clone
      source = createFileTreeSource.localWorkingCopy(
        clone.path,
        owner,
        repo,
        repository.remoteUrl,
        clone.currentBranch,
      );
      source.id = existingSourceId;
      source.isDefault = true;
      this.addSource(source);
    }

    // Make it active
    this.setActiveSource(source.id);

    // Load its tree
    await this.loadSourceTree(source.id);

    return source;
  }

  /**
   * Clean up expired temporary sources
   */
  cleanupTemporarySources(maxAge: number = 30 * 60 * 1000): number {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, source] of this.sources.entries()) {
      if (source.isTemporary && source.createdAt) {
        if (now - source.createdAt > maxAge) {
          toRemove.push(id);
        }
      }
    }

    toRemove.forEach((id) => this.removeSource(id));
    return toRemove.length;
  }

  /**
   * Refresh a source (invalidate cache and optionally reload)
   * @deprecated Use RepositoryDataCache instead
   */
  async refreshSource(
    sourceId: string,
    reload: boolean = false,
  ): Promise<LoadedFileTreeSource | null> {
    return null;
  }

  /**
   * Refresh all sources of a specific type
   * @deprecated Use RepositoryDataCache instead
   */
  async refreshSourcesByType(type: 'local' | 'remote'): Promise<void> {
    // No-op
  }

  /**
   * Update source metadata
   */
  updateSourceMetadata(
    sourceId: string,
    metadata: Partial<FileTreeSource['metadata']>,
  ): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.metadata = {
        ...source.metadata,
        ...metadata,
      };
    }
  }

  /**
   * Clear all sources
   */
  clear(): void {
    // Note: Cache invalidation removed - use RepositoryDataCache instead
    this.sources.clear();
    this.activeSourceId = null;
  }

  /**
   * Get statistics about sources
   */
  getStatistics(): {
    totalSources: number;
    localSources: number;
    remoteSources: number;
    temporarySources: number;
    activeSourceId: string | null;
    cacheStats: any;
  } {
    const sources = this.getAllSources();

    return {
      totalSources: sources.length,
      localSources: sources.filter((s) => s.type === 'local').length,
      remoteSources: sources.filter((s) => s.type === 'remote').length,
      temporarySources: sources.filter(isTemporarySource).length,
      activeSourceId: this.activeSourceId,
      cacheStats: {}, // No cache stats available
    };
  }

  /**
   * Export sources for persistence
   */
  exportSources(): {
    sources: FileTreeSource[];
    activeSourceId: string | null;
  } {
    return {
      sources: this.getAllSources(),
      activeSourceId: this.activeSourceId,
    };
  }

  /**
   * Import sources from persistence
   */
  importSources(data: {
    sources: FileTreeSource[];
    activeSourceId?: string | null;
  }): void {
    this.clear();

    data.sources.forEach((source) => {
      this.sources.set(source.id, source);
    });

    if (data.activeSourceId && this.sources.has(data.activeSourceId)) {
      this.activeSourceId = data.activeSourceId;
    }

    // Note: Prefetching removed - use RepositoryDataCache instead
  }
}
