import type { CityData } from '@principal-ai/code-city-react';
import { MultiVersionCityBuilder } from '@principal-ai/code-city-react';
import { FileTree } from '@principal-ai/repository-abstraction';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import type { AlexandriaEntry } from '@a24z/core-library';
import { FileTreeSourceService } from '../../../../services/FileTreeSourceService';
import { MonitoredFileTreeService } from '../../../../services/MonitoredFileTreeService';
import { createFileTreeSource } from '../../../../types/file-tree-source';

export interface CityBuildResult {
  cityData: CityData | null;
  treeStats: { fileCount: number; directoryCount: number } | null;
  error?: string;
}

export interface CityBuildOptions {
  /** Whether to include git HEAD tree for comparison */
  includeGitHead?: boolean;
  /** Cache key suffix for this build */
  cacheKey?: string;
}

/**
 * Service for building city data from repository information.
 * Provides a simplified interface for the RepositoryExplorer components.
 */
export class RepositoryCityService {
  private fileTreeService: FileTreeSourceService;
  private static instance: RepositoryCityService | null = null;

  constructor() {
    this.fileTreeService = new FileTreeSourceService(new MonitoredFileTreeService());
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RepositoryCityService {
    if (!RepositoryCityService.instance) {
      RepositoryCityService.instance = new RepositoryCityService();
    }
    return RepositoryCityService.instance;
  }

  /**
   * Build city data for a repository
   */
  async buildCityData(
    repository: EnhancedAlexandriaEntry,
    options: CityBuildOptions = {}
  ): Promise<CityBuildResult> {
    try {
      if (!repository?.path) {
        return {
          cityData: null,
          treeStats: null,
          error: 'Repository path is required',
        };
      }

      console.log('[RepositoryCityService] Building city for:', repository.name);

      // Create repository representation compatible with FileTreeSourceService
      const repoForService = {
        ...repository,
        localClones: repository.path ? [{ path: repository.path }] : [],
        // Ensure we have required fields
        owner: (repository as any).github?.owner || (repository as any).owner || 'local',
        name: repository.name || 'unknown',
        remoteUrl: (repository as any).github?.htmlUrl || (repository as any).remoteUrl || repository.path,
        vcsType: 'git' as const,
        addedAt: new Date().toISOString(),
      };

      // Initialize sources from repository
      const sources = this.fileTreeService.initializeFromRepository(repoForService);

      if (sources.length === 0) {
        return {
          cityData: null,
          treeStats: null,
          error: 'No valid sources found for repository',
        };
      }

      const primarySource = sources[0];
      console.log('[RepositoryCityService] Using source:', primarySource.id);

      // Load the file tree
      const loadedSource = await this.fileTreeService.loadSourceTree(primarySource.id);
      if (!loadedSource) {
        return {
          cityData: null,
          treeStats: null,
          error: 'Failed to load file tree',
        };
      }

      // Calculate tree stats
      const treeStats = {
        fileCount: loadedSource.treeStats.fileCount,
        directoryCount: loadedSource.treeStats.directoryCount,
      };

      console.log('[RepositoryCityService] Tree stats:', treeStats);

      // Prepare trees for city building
      const versions = new Map<string, FileTree>();
      versions.set(primarySource.id, loadedSource.tree);

      // TODO: Optionally add HEAD tree for git changes
      if (options.includeGitHead) {
        console.log('[RepositoryCityService] Git HEAD support not yet implemented');
      }

      console.log('[RepositoryCityService] Building city with', versions.size, 'version(s)');

      // Build city using MultiVersionCityBuilder
      const startTime = performance.now();
      const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(
        versions,
        {},
      );
      const buildTime = performance.now() - startTime;

      // Get presence data for primary source
      const presence = presenceByVersion.get(primarySource.id);
      if (!presence) {
        return {
          cityData: null,
          treeStats,
          error: 'No presence data for primary source',
        };
      }

      // Get version view
      const cityStartTime = performance.now();
      const cityData = MultiVersionCityBuilder.getVersionView(unionCity, presence);
      const cityTime = performance.now() - cityStartTime;

      const totalTime = buildTime + cityTime;
      console.log(
        '[RepositoryCityService] City built successfully:',
        `build=${buildTime.toFixed(1)}ms`,
        `city=${cityTime.toFixed(1)}ms`,
        `total=${totalTime.toFixed(1)}ms`
      );

      return {
        cityData,
        treeStats,
      };

    } catch (error) {
      console.error('[RepositoryCityService] Error building city:', error);
      return {
        cityData: null,
        treeStats: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Create a file tree source for testing/validation
   */
  createSourceForRepository(repository: EnhancedAlexandriaEntry) {
    if (!repository.path) {
      throw new Error('Repository path is required');
    }

    return createFileTreeSource.localWorkingCopy(
      repository.path,
      (repository as any).github?.owner || (repository as any).owner || 'local',
      (repository as any).github?.name || repository.name,
      (repository as any).github?.htmlUrl || (repository as any).remoteUrl || repository.path,
    );
  }

  /**
   * Check if a repository can be visualized
   */
  async canVisualize(repository: EnhancedAlexandriaEntry): Promise<boolean> {
    try {
      if (!repository?.path) {
        return false;
      }

      // Try to create a source
      const source = this.createSourceForRepository(repository);
      
      // Try to load just the file tree (without building city)
      const loadedSource = await this.fileTreeService.loadSourceTree(source.id);
      
      return loadedSource !== null && loadedSource.treeStats.fileCount > 0;
    } catch (error) {
      console.warn('[RepositoryCityService] Cannot visualize repository:', error);
      return false;
    }
  }

  /**
   * Get quick stats for a repository without building the full city
   */
  async getRepositoryStats(repository: EnhancedAlexandriaEntry): Promise<{ fileCount: number; directoryCount: number } | null> {
    try {
      if (!repository?.path) {
        return null;
      }

      const source = this.createSourceForRepository(repository);
      const loadedSource = await this.fileTreeService.loadSourceTree(source.id);
      
      if (!loadedSource) {
        return null;
      }

      return {
        fileCount: loadedSource.treeStats.fileCount,
        directoryCount: loadedSource.treeStats.directoryCount,
      };
    } catch (error) {
      console.warn('[RepositoryCityService] Cannot get repository stats:', error);
      return null;
    }
  }
}