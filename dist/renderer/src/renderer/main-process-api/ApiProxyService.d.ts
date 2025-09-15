/**
 * Service layer for API Proxy functionality
 * ALL window.mainProcess.apiProxy calls MUST be encapsulated here
 *
 * This service provides a proxy to call backend APIs through the main process
 * to avoid CORS issues in the renderer process.
 */
import type { JSONValue } from '../../shared/main-process-api-interfaces/ApiProxyAPI';
export interface ApiProxyStatusResult {
    success: boolean;
    status?: string;
    githubHandle?: string;
    email?: string;
    metadata?: Record<string, unknown>;
    error?: string;
}
export interface ApiProxyCallOptions {
    endpoint: string;
    method?: string;
    headers?: Record<string, string>;
    body?: JSONValue;
}
export interface ApiProxyCallResult<T = unknown> {
    success: boolean;
    status?: number;
    data?: T;
    error?: string;
}
export declare class ApiProxyService {
    /**
     * Check authentication status with token
     */
    static checkStatus(token: string): Promise<ApiProxyStatusResult>;
    /**
     * Generic API call proxy
     * Makes API calls through the main process to avoid CORS issues
     */
    static call<T = unknown>(options: ApiProxyCallOptions): Promise<ApiProxyCallResult<T>>;
}
//# sourceMappingURL=ApiProxyService.d.ts.map