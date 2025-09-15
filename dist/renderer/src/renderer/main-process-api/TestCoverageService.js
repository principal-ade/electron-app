/**
 * Service layer for test coverage functionality
 * ALL window.mainProcess.testCoverage calls MUST be encapsulated here
 */
export class TestCoverageService {
    static cache = new Map();
    static cacheTimeout = 5 * 60 * 1000; // 5 minutes
    /**
     * Collect test coverage for specified packages
     */
    static async collectCoverage(rootPath, packages, options = {}) {
        const cacheKey = `${rootPath}-${packages.map(p => p.name).join(',')}`;
        // Check cache if enabled
        if (options.useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('[TestCoverageService] Using cached coverage data');
                return cached;
            }
        }
        console.log('[TestCoverageService] Collecting test coverage for packages:', packages);
        try {
            const result = await window.mainProcess.testCoverage.collectCoverage(rootPath, packages, options);
            // Cache the result
            if (options.useCache) {
                this.cache.set(cacheKey, result);
            }
            return result;
        }
        catch (error) {
            console.error('[TestCoverageService] Failed to collect coverage:', error);
            throw error;
        }
    }
    /**
     * Cancel coverage collection for a specific package
     */
    static async cancelCoverage(packageName) {
        try {
            await window.mainProcess.testCoverage.cancelCoverage(packageName);
        }
        catch (error) {
            console.error('[TestCoverageService] Failed to cancel coverage:', error);
            throw error;
        }
    }
    /**
     * Cancel all running coverage collections
     */
    static async cancelAllCoverage() {
        try {
            await window.mainProcess.testCoverage.cancelAllCoverage();
        }
        catch (error) {
            console.error('[TestCoverageService] Failed to cancel all coverage:', error);
            throw error;
        }
    }
    /**
     * Clear the cache
     */
    static clearCache() {
        this.cache.clear();
    }
    /**
     * Get coverage summary for a file path
     */
    static getCoverageForFile(result, filePath) {
        for (const pkg of result.packages) {
            // Convert the serialized array back to Map for searching
            const fileCoverageMap = new Map(pkg.fileCoverage);
            const coverage = fileCoverageMap.get(filePath);
            if (coverage) {
                return coverage;
            }
        }
        return null;
    }
    /**
     * Get coverage class for percentage (for styling)
     */
    static getCoverageClass(percentage) {
        if (percentage >= 80)
            return 'high';
        if (percentage >= 50)
            return 'medium';
        return 'low';
    }
    /**
     * Format coverage percentage for display
     */
    static formatCoverage(percentage) {
        return `${percentage}%`;
    }
}
