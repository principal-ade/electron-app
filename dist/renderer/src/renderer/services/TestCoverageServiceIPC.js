/**
 * IPC wrapper for test coverage collection service
 * This runs in the renderer process and communicates with the main process
 *
 * DEPRECATED: This file is now a compatibility layer.
 * New code should use TestCoverageService from '../main-process-api/TestCoverageService'
 */
import { TestCoverageService } from '../main-process-api/TestCoverageService';
class TestCoverageServiceIPC {
    /**
     * Collect test coverage for specified packages
     * @deprecated Use TestCoverageService.collectCoverage instead
     */
    async collectCoverage(rootPath, packages, options = {}) {
        return TestCoverageService.collectCoverage(rootPath, packages, options);
    }
    /**
     * Cancel coverage collection for a specific package
     * @deprecated Use TestCoverageService.cancelCoverage instead
     */
    async cancelCoverage(packageName) {
        return TestCoverageService.cancelCoverage(packageName);
    }
    /**
     * Cancel all running coverage collections
     * @deprecated Use TestCoverageService.cancelAllCoverage instead
     */
    async cancelAllCoverage() {
        return TestCoverageService.cancelAllCoverage();
    }
    /**
     * Clear the cache
     * @deprecated Use TestCoverageService.clearCache instead
     */
    clearCache() {
        TestCoverageService.clearCache();
    }
    /**
     * Get coverage summary for a file path
     * @deprecated Use TestCoverageService.getCoverageForFile instead
     */
    getCoverageForFile(result, filePath) {
        return TestCoverageService.getCoverageForFile(result, filePath);
    }
    /**
     * Get coverage class for percentage (for styling)
     * @deprecated Use TestCoverageService.getCoverageClass instead
     */
    getCoverageClass(percentage) {
        return TestCoverageService.getCoverageClass(percentage);
    }
    /**
     * Format coverage percentage for display
     * @deprecated Use TestCoverageService.formatCoverage instead
     */
    formatCoverage(percentage) {
        return TestCoverageService.formatCoverage(percentage);
    }
}
// Export singleton instance
export const testCoverageService = new TestCoverageServiceIPC();
