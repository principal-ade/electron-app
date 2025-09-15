class ViolationsServiceImpl {
    async collect(sourcePath, packages, options = {}) {
        try {
            return await window.mainProcess.violations.collect(sourcePath, packages, options);
        }
        catch (error) {
            console.error('[ViolationsService] Failed to collect violations:', error);
            throw error;
        }
    }
    async clearCache(sourcePath) {
        try {
            await window.mainProcess.violations.clearCache(sourcePath);
        }
        catch (error) {
            console.error('[ViolationsService] Failed to clear cache:', error);
            throw error;
        }
    }
}
export const ViolationsService = new ViolationsServiceImpl();
