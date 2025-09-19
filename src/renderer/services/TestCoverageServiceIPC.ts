/**
 * IPC wrapper for test coverage collection service
 * This runs in the renderer process and communicates with the main process
 *
 * DEPRECATED: This file is now a compatibility layer.
 * New code should use TestCoverageService from '../main-process-api/TestCoverageService'
 */

import { TestCoverageService } from '../main-process-api/TestCoverageService';
import type {
  TestCoverageResult,
  PackageCoverage,
  FileCoverage,
  CoverageCollectionOptions,
} from '../../shared/main-process-api-interfaces/TestCoverageAPI';

export type { TestCoverageResult, PackageCoverage, FileCoverage };

export interface CoverageCollectionOptionsCompat
  extends CoverageCollectionOptions {
  useCache?: boolean;
}

class TestCoverageServiceIPC {
  /**
   * Collect test coverage for specified packages
   * @deprecated Use TestCoverageService.collectCoverage instead
   */
  async collectCoverage(
    rootPath: string,
    packages: Array<{ name: string; path: string }>,
    options: CoverageCollectionOptionsCompat = {},
  ): Promise<TestCoverageResult> {
    return TestCoverageService.collectCoverage(rootPath, packages, options);
  }

  /**
   * Cancel coverage collection for a specific package
   * @deprecated Use TestCoverageService.cancelCoverage instead
   */
  async cancelCoverage(packageName: string): Promise<void> {
    return TestCoverageService.cancelCoverage(packageName);
  }

  /**
   * Cancel all running coverage collections
   * @deprecated Use TestCoverageService.cancelAllCoverage instead
   */
  async cancelAllCoverage(): Promise<void> {
    return TestCoverageService.cancelAllCoverage();
  }

  /**
   * Clear the cache
   * @deprecated Use TestCoverageService.clearCache instead
   */
  clearCache(): void {
    TestCoverageService.clearCache();
  }

  /**
   * Get coverage summary for a file path
   * @deprecated Use TestCoverageService.getCoverageForFile instead
   */
  getCoverageForFile(
    result: TestCoverageResult,
    filePath: string,
  ): FileCoverage | null {
    return TestCoverageService.getCoverageForFile(result, filePath);
  }

  /**
   * Get coverage class for percentage (for styling)
   * @deprecated Use TestCoverageService.getCoverageClass instead
   */
  getCoverageClass(percentage: number): 'high' | 'medium' | 'low' {
    return TestCoverageService.getCoverageClass(percentage);
  }

  /**
   * Format coverage percentage for display
   * @deprecated Use TestCoverageService.formatCoverage instead
   */
  formatCoverage(percentage: number): string {
    return TestCoverageService.formatCoverage(percentage);
  }
}

// Export singleton instance
export const testCoverageService = new TestCoverageServiceIPC();
