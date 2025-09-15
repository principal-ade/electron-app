/**
 * API Proxy Service
 * Handles API calls from renderer to avoid CORS issues
 * Only proxies API calls, no OAuth flow management
 */
import { ipcMain } from 'electron';
import fetch from 'node-fetch';
export function registerApiProxyHandlers() {
    const baseUrl = 'https://principle-md.com';
    console.log('[ApiProxy] Registering handlers...');
    // Check authentication status
    ipcMain.handle('api:checkStatus', async (_, token) => {
        try {
            const response = await fetch(`${baseUrl}/api/orbit/auth/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                console.log('[ApiProxy] Status check failed:', response.status, response.statusText);
                return {
                    success: false,
                    status: 'unauthenticated',
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
            const data = await response.json();
            console.log('[ApiProxy] Status check response:', data);
            return {
                success: true,
                ...(typeof data === 'object' && data !== null ? data : {})
            };
        }
        catch (error) {
            console.error('[ApiProxy] Status check error:', error);
            return {
                success: false,
                status: 'unauthenticated',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });
    // Generic API call proxy for future use
    ipcMain.handle('api:call', async (_, { endpoint, method = 'GET', headers = {}, body = null }) => {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            if (body && method !== 'GET') {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            const data = await response.json();
            return {
                success: response.ok,
                status: response.status,
                data
            };
        }
        catch (error) {
            console.error('[ApiProxy] API call error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });
    console.log('[ApiProxy] Handlers registered successfully');
}
