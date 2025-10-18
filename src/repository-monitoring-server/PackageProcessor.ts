/**
 * PackageProcessor - Extracts and analyzes package information from repositories
 * Uses @principal-ai/codebase-composition for package detection
 */

import {
  PackageLayerModule,
  PackageLayer,
  FileSystemAdapter,
} from '@principal-ai/codebase-composition';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageSummary } from './types';
import { QualityScoreEnrichment } from './QualityScoreEnrichment';

/**
 * File system adapter for reading package.json files in the worker process
 */
class WorkerFileSystemAdapter implements FileSystemAdapter {
  constructor(private basePath: string) {}

  async readFile(filePath: string): Promise<{ content: string } | null> {
    try {
      // Convert relative path to absolute
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.basePath, filePath);

      const content = await fs.readFile(absolutePath, 'utf-8');
      return { content };
    } catch (error) {
      console.error(
        `[WorkerFileSystemAdapter] Failed to read ${filePath}:`,
        error,
      );
      return null;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.basePath, filePath);

      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const absolutePath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(this.basePath, dirPath);

      const entries = await fs.readdir(absolutePath);
      return entries;
    } catch (error) {
      console.error(
        `[WorkerFileSystemAdapter] Failed to read directory ${dirPath}:`,
        error,
      );
      return [];
    }
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.basePath, filePath);

      const stats = await fs.stat(absolutePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  // Required by FileSystemAdapter interface but not used by PackageLayerModule
  async buildFilteredFileTree(
    _directoryPath: string,
    _patterns?: string[],
    _sourceDirectory?: string,
  ): Promise<{
    paths: string[];
    stats?: Map<
      string,
      { size: number; isDirectory: boolean; lastModified: Date }
    >;
  }> {
    // This method is not used by PackageLayerModule.discoverPackages
    // It's only used in other contexts, so we provide a stub implementation
    return { paths: [] };
  }
}

export class PackageProcessor {
  private packageModule: PackageLayerModule;
  private enrichment: QualityScoreEnrichment;

  constructor() {
    this.packageModule = new PackageLayerModule();
    this.enrichment = new QualityScoreEnrichment();
  }

  /**
   * Extract packages from a file tree
   * @param fileTree The file tree to analyze
   * @param repoPath The absolute path to the repository
   * @param options Optional configuration
   * @param options.enrichWithQualityScores Whether to run quality lenses (default: false)
   * @returns Array of PackageLayer objects representing found packages
   */
  async extractPackages(
    fileTree: FileTree,
    repoPath: string,
    options: { enrichWithQualityScores?: boolean } = {},
  ): Promise<PackageLayer[]> {
    const { enrichWithQualityScores = false } = options;

    try {
      // Create file reader adapter for this repository
      const adapter = new WorkerFileSystemAdapter(repoPath);

      // Create a file reader function that discoverPackages expects
      const fileReader = async (filePath: string): Promise<string> => {
        const result = await adapter.readFile(filePath);
        return result?.content || '';
      };

      // Discover packages using the standard module
      const packages = await this.packageModule.discoverPackages(
        fileTree,
        fileReader,
      );

      console.info(
        `[PackageProcessor] Found ${packages.length} packages in ${repoPath}`,
      );

      // Only enrich with quality scores if explicitly requested (on-demand)
      if (enrichWithQualityScores) {
        console.info(
          `[PackageProcessor] Running quality lenses for ${packages.length} packages in ${repoPath}`,
        );
        const enrichedPackages = await this.enrichment.enrichPackages(
          packages,
          repoPath,
        );
        return enrichedPackages;
      }

      console.info(
        `[PackageProcessor] Skipping quality enrichment (on-demand only)`,
      );
      return packages;
    } catch (error) {
      console.error('[PackageProcessor] Failed to extract packages:', error);
      return [];
    }
  }

  /**
   * Generate a summary of all packages in the repository
   * @param packages Array of PackageLayer objects
   * @returns PackageSummary with aggregated information
   */
  async getPackageSummary(packages: PackageLayer[]): Promise<PackageSummary> {
    // Find the root package (path is empty string for root)
    const rootPackage = packages.find((p) => p.packageData.path === '');

    // Find workspace packages (everything except root)
    const workspacePackages = packages.filter((p) => p.packageData.path !== '');

    // Aggregate all dependencies
    const allDependencies = new Set<string>();
    const allDevDependencies = new Set<string>();

    packages.forEach((pkg) => {
      // Add regular dependencies
      if (pkg.packageData.dependencies) {
        Object.keys(pkg.packageData.dependencies).forEach((dep) =>
          allDependencies.add(dep),
        );
      }
      // Add dev dependencies
      if (pkg.packageData.devDependencies) {
        Object.keys(pkg.packageData.devDependencies).forEach((dep) =>
          allDevDependencies.add(dep),
        );
      }
    });

    // Get available scripts/commands from root package
    const availableScripts = rootPackage?.packageData.availableCommands
      ? rootPackage.packageData.availableCommands.map((cmd) => cmd.name)
      : [];

    return {
      isMonorepo: workspacePackages.length > 0,
      rootPackageName: rootPackage?.packageData.name,
      totalPackages: packages.length,
      workspacePackages: workspacePackages.map((p) => ({
        name: p.packageData.name,
        path: p.packageData.path,
      })),
      totalDependencies: allDependencies.size,
      totalDevDependencies: allDevDependencies.size,
      availableScripts,
    };
  }
}
