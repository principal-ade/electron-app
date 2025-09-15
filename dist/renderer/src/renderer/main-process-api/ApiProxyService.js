/**
 * Service layer for API Proxy functionality
 * ALL window.mainProcess.apiProxy calls MUST be encapsulated here
 *
 * This service provides a proxy to call backend APIs through the main process
 * to avoid CORS issues in the renderer process.
 */
export class ApiProxyService {
    /**
     * Check authentication status with token
     */
    static async checkStatus(token) {
        try {
            return await window.mainProcess.apiProxy.checkStatus(token);
        }
        catch (error) {
            console.error('[ApiProxyService] Failed to check status:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to check status'
            };
        }
    }
    /**
     * Generic API call proxy
     * Makes API calls through the main process to avoid CORS issues
     */
    static async call(options) {
        try {
            return await window.mainProcess.apiProxy.call(options);
        }
        catch (error) {
            console.error('[ApiProxyService] Failed to make API call:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to make API call'
            };
        }
    }
}
