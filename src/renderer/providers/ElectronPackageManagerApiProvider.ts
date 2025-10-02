import {
  PackageManagerApiProvider,
  PackageManager,
  PackageVersionInfo,
  VersionCheckResult,
  VulnerabilityCheckResult,
  LicenseCheckResult,
  BatchCheckOptions,
  DependencyCheckProgress,
} from '@principal-ai/codebase-composition';
import { PackageManagerService } from '../main-process-api/PackageManagerService';
import type { CheckProgressData } from '../../shared/main-process-api-interfaces/PackageManagerAPI';

/**
 * Electron implementation of PackageManagerApiProvider that uses IPC
 * to communicate with the main process for NPM registry API calls.
 * This ensures consistent behavior regardless of local package manager installations.
 */
export class ElectronPackageManagerApiProvider extends PackageManagerApiProvider {
  private progress: DependencyCheckProgress = {
    phase: 'idle',
    current: 0,
    total: 0,
  };

  async *checkVersions(
    packages: PackageVersionInfo[],
    packageManager: PackageManager,
    options?: BatchCheckOptions,
  ): AsyncGenerator<VersionCheckResult, void, unknown> {
    this.progress = {
      phase: 'checking-versions',
      current: 0,
      total: packages.length,
      message: 'Checking for package updates...',
    };

    try {
      // Check if PackageManagerService is available
      if (!window.mainProcess?.packageManager) {
        throw new Error('Package manager API not available');
      }

      // Set up progress listener first
      const progressUpdates: VersionCheckResult[] = [];
      let progressResolver: (() => void) | null = null;

      const cleanup = PackageManagerService.onVersionCheckProgress(
        (data: CheckProgressData) => {
          if (data.result) {
            progressUpdates.push(data.result as VersionCheckResult);
          }
          if (progressResolver) {
            progressResolver();
            progressResolver = null;
          }
        },
      );

      // Call the main process to check versions
      const allResultsPromise = PackageManagerService.invokeCheckVersions({
        packages,
        packageManager,
        options,
      });

      // Yield results as they come in via progress updates
      let lastYieldedIndex = 0;
      while (this.progress.current < packages.length) {
        // Wait for new progress updates
        if (lastYieldedIndex >= progressUpdates.length) {
          await new Promise<void>((resolve) => {
            progressResolver = resolve;
            // Check if we already have updates while setting up the promise
            if (lastYieldedIndex < progressUpdates.length) {
              resolve();
            }
          });
        }

        // Yield any new results
        while (lastYieldedIndex < progressUpdates.length) {
          const result = progressUpdates[lastYieldedIndex];
          this.progress.current++;
          yield result;
          lastYieldedIndex++;
        }
      }

      // Wait for the final results to ensure everything completed
      await allResultsPromise;

      // Clean up the listener
      cleanup();
    } catch (error) {
      console.error('Error checking versions:', error);
      // Yield error results for remaining packages
      for (let i = this.progress.current; i < packages.length; i++) {
        yield {
          packageName: packages[i].name,
          currentVersion: packages[i].currentVersion,
          isOutdated: false,
          error:
            error instanceof Error ? error.message : 'Failed to check version',
        };
        this.progress.current++;
      }
    } finally {
      this.progress.phase = 'complete';
    }
  }

  async *checkVulnerabilities(
    packages: PackageVersionInfo[],
  ): AsyncGenerator<VulnerabilityCheckResult, void, unknown> {
    this.progress = {
      phase: 'checking-vulnerabilities',
      current: 0,
      total: packages.length,
      message: 'Scanning for vulnerabilities...',
    };

    // TODO: Implement vulnerability checking in PackageManagerService
    throw new Error('Vulnerability checking not yet implemented');
  }

  async *checkLicenses(
    packages: PackageVersionInfo[],
  ): AsyncGenerator<LicenseCheckResult, void, unknown> {
    this.progress = {
      phase: 'checking-licenses',
      current: 0,
      total: packages.length,
      message: 'Checking package licenses...',
    };

    // TODO: Implement license checking in PackageManagerService
    throw new Error('License checking not yet implemented');
  }

  getProgress(): DependencyCheckProgress {
    return { ...this.progress };
  }
}
