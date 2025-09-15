class GitWatcherServiceImpl {
    statusListeners = new Set();
    removeListenerFn = null;
    constructor() {
        this.setupListener();
    }
    setupListener() {
        // Set up the listener for status updates using the gitWatcher API
        this.removeListenerFn = window.mainProcess.gitWatcher.onStatusUpdate((status) => {
            this.statusListeners.forEach(listener => {
                try {
                    listener(status);
                }
                catch (error) {
                    console.error('[GitWatcherService] Error in status listener:', error);
                }
            });
        });
    }
    async watchRepository(repoPath) {
        try {
            return await window.mainProcess.gitWatcher.watchRepository(repoPath);
        }
        catch (error) {
            console.error('[GitWatcher] Failed to watch repository:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async unwatchRepository(repoPath) {
        try {
            return await window.mainProcess.gitWatcher.unwatchRepository(repoPath);
        }
        catch (error) {
            console.error('[GitWatcher] Failed to unwatch repository:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getStatus(repoPath) {
        try {
            return await window.mainProcess.gitWatcher.getStatus(repoPath);
        }
        catch (error) {
            console.error('[GitWatcher] Failed to get status:', error);
            return null;
        }
    }
    async getAllStatuses() {
        try {
            return await window.mainProcess.gitWatcher.getAllStatuses();
        }
        catch (error) {
            console.error('[GitWatcher] Failed to get all statuses:', error);
            return {};
        }
    }
    async refreshStatus(repoPath) {
        try {
            console.log(`[GitWatcher Service] Refreshing status for: ${repoPath}`);
            const status = await window.mainProcess.gitWatcher.refreshStatus(repoPath);
            console.log(`[GitWatcher Service] Received status:`, status);
            return status;
        }
        catch (error) {
            console.error('[GitWatcher Service] Failed to refresh status:', error);
            return null;
        }
    }
    async refreshAllStatuses() {
        try {
            // Get all current statuses
            const allStatuses = await this.getAllStatuses();
            const repoPaths = Object.keys(allStatuses);
            // Refresh each repository in parallel
            const refreshPromises = repoPaths.map(async (path) => {
                const status = await this.refreshStatus(path);
                return { path, status };
            });
            const results = await Promise.all(refreshPromises);
            // Build the updated statuses object
            const updatedStatuses = {};
            results.forEach(({ path, status }) => {
                if (status) {
                    updatedStatuses[path] = status;
                }
            });
            return updatedStatuses;
        }
        catch (error) {
            console.error('[GitWatcher] Failed to refresh all statuses:', error);
            return {};
        }
    }
    onStatusUpdate(callback) {
        this.statusListeners.add(callback);
        // Return cleanup function
        return () => {
            this.statusListeners.delete(callback);
        };
    }
    destroy() {
        if (this.removeListenerFn) {
            this.removeListenerFn();
            this.removeListenerFn = null;
        }
        this.statusListeners.clear();
    }
}
// Export singleton instance
export const GitWatcherService = new GitWatcherServiceImpl();
