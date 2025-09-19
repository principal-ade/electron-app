/**
 * Renderer-side violation monitoring service that uses IPC
 * to communicate with the main process
 */

import { FileTree } from '@principal-ai/repository-abstraction';
import { FileTreeSource } from '../types/file-tree-source';
import { ViolationsService } from '../main-process-api/ViolationsService';
import * as path from 'path';

export type ViolationType = 'typescript' | 'eslint';
export type ViolationSeverity = 'error' | 'warning' | 'info';

export interface Violation {
  type: ViolationType;
  severity: ViolationSeverity;
  message: string;
  rule?: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface FileViolations {
  filePath: string;
  relativePath: string;
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface PackageViolations {
  packageName: string;
  packagePath: string;
  absolutePath?: string; // Absolute path for matching with selected package
  fileViolations: Map<string, FileViolations>;
  totalFiles: number;
  totalViolations: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
}

export interface ViolationMonitoringResult {
  timestamp: number;
  source: FileTreeSource;
  packages: PackageViolations[];
  totalPackages: number;
  totalFiles: number;
  totalViolations: number;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  collectionTime: number;
}

export interface MonitoringOptions {
  includeTypescript?: boolean;
  includeEslint?: boolean;
  filePatterns?: string[];
  excludePatterns?: string[];
  maxFilesToProcess?: number;
  useCache?: boolean;
}

class ViolationMonitoringServiceIPC {
  private cache = new Map<string, ViolationMonitoringResult>();
  private activeMonitoring = new Map<string, AbortController>();

  async monitorViolations(
    source: FileTreeSource,
    packageLayers: any[], // PackageLayer[] from core
    options: MonitoringOptions = {},
  ): Promise<ViolationMonitoringResult> {
    // Only works with local sources
    if (source.type !== 'local' || !source.location) {
      return this.emptyResult(source);
    }

    // Check cache
    if (options.useCache) {
      const cached = this.cache.get(source.id);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached;
      }
    }

    // Cancel any existing monitoring for this source
    this.cancelMonitoring(source.id);

    // Create abort controller for this monitoring session
    const abortController = new AbortController();
    this.activeMonitoring.set(source.id, abortController);

    try {
      console.log(
        '[ViolationMonitoringServiceIPC] Processing packageLayers:',
        packageLayers.length,
        'layers',
      );

      // Convert package layers to package info
      const packages = packageLayers.map((layer) => {
        console.log('[ViolationMonitoringServiceIPC] Processing layer:', {
          name: layer.packageData?.name,
          path: layer.packageData?.path,
          configFiles: layer.configFiles,
          hasEslintConfig: !!layer.configFiles?.eslint,
          hasTypescriptConfig: !!layer.configFiles?.typescript,
        });

        // Check the structure of the layer
        if (!layer.packageData) {
          console.warn(
            '[ViolationMonitoringServiceIPC] Layer missing packageData:',
            layer,
          );
        }

        // Use configFiles detection from PackageLayer for more accurate detection
        const hasTypescriptConfig = !!layer.configFiles?.typescript;
        const hasEslintConfig = !!layer.configFiles?.eslint;

        // Also check dependencies as a fallback
        const hasTypescriptDep = !!(
          layer.packageData?.dependencies?.['typescript'] ||
          layer.packageData?.devDependencies?.['typescript'] ||
          layer.packageData?.dependencies?.['@types/node']
        );

        const hasEslintDep =
          !!(
            layer.packageData?.dependencies &&
            Object.keys(layer.packageData.dependencies).some((dep) =>
              dep.includes('eslint'),
            )
          ) ||
          !!(
            layer.packageData?.devDependencies &&
            Object.keys(layer.packageData.devDependencies).some((dep) =>
              dep.includes('eslint'),
            )
          );

        // Fix package path to be relative to the source location
        const originalPath = layer.packageData?.path || '';
        let packagePath = originalPath;

        // If the path is absolute and doesn't start with the source location,
        // we need to make it relative to the source location
        if (path.isAbsolute(packagePath)) {
          if (packagePath.startsWith(source.location)) {
            // Path is already correct - make it relative
            packagePath = path.relative(source.location, packagePath);
          } else {
            // Path is wrong - likely from a different repo context
            // Use just the package name as the relative path
            packagePath = layer.packageData?.name || '';
            console.warn(
              `[ViolationMonitoringServiceIPC] Package path ${layer.packageData?.path} doesn't match source location ${source.location}, using package name as relative path: ${packagePath}`,
            );
          }
        }

        const pkg = {
          name: layer.packageData?.name || 'unknown',
          path: packagePath,
          absolutePath: originalPath, // Keep the original absolute path for matching
          // Has TypeScript if there's a tsconfig.json or typescript dependency
          hasTypescript: hasTypescriptConfig || hasTypescriptDep,
          // Has ESLint if there's an eslint config file or eslint dependency
          hasEslint: hasEslintConfig || hasEslintDep,
        };

        console.log('[ViolationMonitoringServiceIPC] Final package decision:', {
          name: pkg.name,
          path: pkg.path,
          absolutePath: pkg.absolutePath,
          hasTypescript: pkg.hasTypescript,
          hasEslint: pkg.hasEslint,
          reasoning: {
            eslint: {
              config: hasEslintConfig,
              dependency: hasEslintDep,
              final: pkg.hasEslint,
            },
            typescript: {
              config: hasTypescriptConfig,
              dependency: hasTypescriptDep,
              final: pkg.hasTypescript,
            },
          },
        });
        return pkg;
      });

      console.log(
        '[ViolationMonitoringServiceIPC] Calling main process with:',
        {
          sourceLocation: source.location,
          sourceId: source.id,
          sourceType: source.type,
          packageCount: packages.length,
          packages: packages.map((p) => ({ name: p.name, path: p.path })),
        },
      );

      // Call main process via ViolationsService
      const result = (await ViolationsService.collect(
        source.location,
        packages,
        {
          includeTypescript: options.includeTypescript ?? true,
          includeEslint: options.includeEslint ?? true,
          maxFiles: options.maxFilesToProcess ?? 500,
        },
      )) as any;

      // Check if aborted
      if (abortController.signal.aborted) {
        return this.emptyResult(source);
      }

      // Convert arrays back to Maps for each package
      const processedPackages = result.packages.map((pkg: any) => ({
        ...pkg,
        fileViolations: new Map<string, FileViolations>(pkg.fileViolations),
      }));

      const monitoringResult: ViolationMonitoringResult = {
        timestamp: result.timestamp,
        source,
        packages: processedPackages,
        totalPackages: result.totalPackages,
        totalFiles: result.totalFiles,
        totalViolations: result.totalViolations,
        totalErrors: result.totalErrors,
        totalWarnings: result.totalWarnings,
        totalInfo: result.totalInfo,
        collectionTime: result.collectionTime,
      };

      // Cache result
      if (options.useCache) {
        this.cache.set(source.id, monitoringResult);
      }

      return monitoringResult;
    } catch (error) {
      console.error('[ViolationMonitoring] Error:', error);
      return this.emptyResult(source);
    } finally {
      this.activeMonitoring.delete(source.id);
    }
  }

  /**
   * Cancel monitoring for a source
   * Since the actual monitoring happens in the main process,
   * this just cleans up local state
   */
  cancelMonitoring(sourceId: string) {
    const controller = this.activeMonitoring.get(sourceId);
    if (controller) {
      controller.abort();
      this.activeMonitoring.delete(sourceId);
    }
  }

  async clearCache(sourceId?: string) {
    if (sourceId) {
      this.cache.delete(sourceId);
      // Also clear in main process
      const source = this.cache.get(sourceId);
      if (source?.source.type === 'local' && source.source.location) {
        await ViolationsService.clearCache(source.source.location);
      }
    } else {
      this.cache.clear();
      await ViolationsService.clearCache();
    }
  }

  toHighlightLayer(
    result: ViolationMonitoringResult,
  ): Map<string, { color: string; intensity: number }> {
    const highlights = new Map<string, { color: string; intensity: number }>();

    // Iterate through all packages and their file violations
    for (const pkg of result.packages) {
      for (const [relativePath, fileViolations] of pkg.fileViolations) {
        let color: string;
        let intensity: number;

        if (fileViolations.errorCount > 0) {
          color = '#ef4444';
          intensity = Math.min(0.5 + fileViolations.errorCount * 0.1, 1.0);
        } else if (fileViolations.warningCount > 0) {
          color = '#f59e0b';
          intensity = Math.min(0.3 + fileViolations.warningCount * 0.05, 0.7);
        } else if (fileViolations.infoCount > 0) {
          color = '#3b82f6';
          intensity = 0.3;
        } else {
          continue;
        }

        highlights.set(fileViolations.relativePath, { color, intensity });
      }
    }

    return highlights;
  }

  getFileSummary(
    result: ViolationMonitoringResult,
    filePath: string,
  ): string | null {
    // Search through all packages for the file
    let fileViolations: FileViolations | undefined;
    for (const pkg of result.packages) {
      fileViolations = pkg.fileViolations.get(filePath);
      if (fileViolations) break;
    }
    if (!fileViolations || fileViolations.violations.length === 0) {
      return null;
    }

    const lines: string[] = [
      `${fileViolations.relativePath}`,
      `${fileViolations.errorCount} errors, ${fileViolations.warningCount} warnings`,
    ];

    const topViolations = fileViolations.violations.slice(0, 3);
    for (const violation of topViolations) {
      const icon =
        violation.severity === 'error'
          ? '❌'
          : violation.severity === 'warning'
            ? '⚠️'
            : 'ℹ️';
      const rule = violation.rule ? ` (${violation.rule})` : '';
      lines.push(`${icon} Line ${violation.line}: ${violation.message}${rule}`);
    }

    if (fileViolations.violations.length > 3) {
      lines.push(`... and ${fileViolations.violations.length - 3} more`);
    }

    return lines.join('\n');
  }

  private emptyResult(source: FileTreeSource): ViolationMonitoringResult {
    return {
      timestamp: Date.now(),
      source,
      packages: [],
      totalPackages: 0,
      totalFiles: 0,
      totalViolations: 0,
      totalErrors: 0,
      totalWarnings: 0,
      totalInfo: 0,
      collectionTime: 0,
    };
  }
}

export const violationMonitoringService = new ViolationMonitoringServiceIPC();
