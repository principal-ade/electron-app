import type { CityData } from '@principal-ai/code-city-react';
import { MultiVersionCityBuilder } from '@principal-ai/code-city-react';
import { FileTree } from '@principal-ai/repository-abstraction';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import type { AlexandriaEntry } from '@a24z/core-library';
import { RepositoryMonitoringService } from '../../../../main-process-api/RepositoryMonitoringService';

export interface CityBuildResult {
  cityData: CityData | null;
  fileTree: FileTree | null;
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
 * Uses the modern RepositoryMonitoringService for consistent FileTree data.
 */
export class RepositoryCityService {
  private static instance: RepositoryCityService | null = null;

  constructor() {
    // No services needed - we use RepositoryMonitoringService directly
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
    options: CityBuildOptions = {},
  ): Promise<CityBuildResult> {
    try {
      if (!repository?.path) {
        return {
          cityData: null,
          fileTree: null,
          treeStats: null,
          error: 'Repository path is required',
        };
      }

      console.log(
        '[RepositoryCityService] Building city for:',
        repository.name,
      );

      // Register repository with monitoring service (idempotent)
      await RepositoryMonitoringService.registerRepository(repository.path);

      // Get FileTree from the monitoring server
      const fileTree = await RepositoryMonitoringService.getFileTree(
        repository.path,
      );
      if (!fileTree) {
        return {
          cityData: null,
          fileTree: null,
          treeStats: null,
          error: 'Failed to get file tree from monitoring service',
        };
      }

      // Calculate tree stats from the FileTree
      const treeStats = this.calculateTreeStats(fileTree);
      console.log('[RepositoryCityService] Tree stats:', treeStats);

      // Prepare trees for city building
      const versions = new Map<string, FileTree>();
      const sourceId = `monitoring-${repository.path}`;
      versions.set(sourceId, fileTree);

      // TODO: Optionally add HEAD tree for git changes
      if (options.includeGitHead) {
        console.log(
          '[RepositoryCityService] Git HEAD support not yet implemented',
        );
      }

      console.log(
        '[RepositoryCityService] Building city with',
        versions.size,
        'version(s)',
      );

      // Build city using MultiVersionCityBuilder
      const startTime = performance.now();
      const { unionCity, presenceByVersion } = MultiVersionCityBuilder.build(
        versions,
        {},
      );
      const buildTime = performance.now() - startTime;

      // Get presence data for our source
      const presence = presenceByVersion.get(sourceId);
      if (!presence) {
        return {
          cityData: null,
          fileTree,
          treeStats,
          error: 'No presence data for repository tree',
        };
      }

      // Get version view
      const cityStartTime = performance.now();
      const cityData = MultiVersionCityBuilder.getVersionView(
        unionCity,
        presence,
      );
      const cityTime = performance.now() - cityStartTime;

      const totalTime = buildTime + cityTime;
      console.log(
        '[RepositoryCityService] City built successfully:',
        `build=${buildTime.toFixed(1)}ms`,
        `city=${cityTime.toFixed(1)}ms`,
        `total=${totalTime.toFixed(1)}ms`,
      );

      return {
        cityData,
        fileTree,
        treeStats,
      };
    } catch (error) {
      console.error('[RepositoryCityService] Error building city:', error);
      return {
        cityData: null,
        fileTree: null,
        treeStats: null,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Calculate file and directory statistics from a FileTree
   */
  private calculateTreeStats(fileTree: FileTree): {
    fileCount: number;
    directoryCount: number;
  } {
    // FileTree already includes stats, so we can use them directly
    if (fileTree.stats) {
      return {
        fileCount: fileTree.stats.totalFiles,
        directoryCount: fileTree.stats.totalDirectories,
      };
    }

    // Fallback: manually count if stats are not available
    return {
      fileCount: fileTree.allFiles?.length || 0,
      directoryCount: fileTree.allDirectories?.length || 0,
    };
  }

  /**
   * Check if a repository can be visualized
   */
  async canVisualize(repository: EnhancedAlexandriaEntry): Promise<boolean> {
    try {
      if (!repository?.path) {
        return false;
      }

      // Try to get file tree from monitoring service
      const fileTree = await RepositoryMonitoringService.getFileTree(
        repository.path,
      );

      if (!fileTree) {
        return false;
      }

      // Check if there are any files
      const stats = this.calculateTreeStats(fileTree);
      return stats.fileCount > 0;
    } catch (error) {
      console.warn(
        '[RepositoryCityService] Cannot visualize repository:',
        error,
      );
      return false;
    }
  }

  /**
   * Get quick stats for a repository without building the full city
   */
  async getRepositoryStats(
    repository: EnhancedAlexandriaEntry,
  ): Promise<{ fileCount: number; directoryCount: number } | null> {
    try {
      if (!repository?.path) {
        return null;
      }

      // Get file tree from monitoring service
      const fileTree = await RepositoryMonitoringService.getFileTree(
        repository.path,
      );

      if (!fileTree) {
        return null;
      }

      return this.calculateTreeStats(fileTree);
    } catch (error) {
      console.warn(
        '[RepositoryCityService] Cannot get repository stats:',
        error,
      );
      return null;
    }
  }
}
