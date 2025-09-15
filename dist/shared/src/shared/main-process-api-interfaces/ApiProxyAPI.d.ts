/**
 * API Proxy Interface
 * Provides methods to call backend APIs through main process to avoid CORS
 */
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
    [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {
}
export interface ApiProxyAPI {
    /**
     * Check authentication status with token
     */
    checkStatus(token: string): Promise<{
        success: boolean;
        status?: string;
        githubHandle?: string;
        email?: string;
        metadata?: Record<string, unknown>;
        error?: string;
    }>;
    /**
     * Generic API call proxy
     */
    call<T = unknown>(options: {
        endpoint: string;
        method?: string;
        headers?: Record<string, string>;
        body?: JSONValue;
    }): Promise<{
        success: boolean;
        status?: number;
        data?: T;
        error?: string;
    }>;
}
//# sourceMappingURL=ApiProxyAPI.d.ts.map