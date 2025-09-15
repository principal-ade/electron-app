/**
 * API Proxy - Renderer side implementation
 * Provides methods to call backend APIs through main process to avoid CORS
 */
export declare const apiProxyApi: {
    /**
     * Check authentication status with token
     */
    checkStatus: (token: string) => Promise<any>;
    /**
     * Generic API call proxy
     */
    call: (options: {
        endpoint: string;
        method?: string;
        headers?: Record<string, string>;
        body?: any;
    }) => Promise<any>;
};
//# sourceMappingURL=apiProxyApi.d.ts.map