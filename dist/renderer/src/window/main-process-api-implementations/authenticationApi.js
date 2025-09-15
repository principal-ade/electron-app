/**
 * AuthenticationAPI implementation for preload script
 *
 * This implementation wraps existing IPC channels to provide a unified
 * authentication interface. During migration, it forwards calls to the
 * existing handlers in AuthService, AuthStateManager, and SecureTokenIPC.
 */
import { ipcRenderer } from 'electron';
export const authenticationAPI = {
    // ===== OAuth Operations =====
    login: async (options) => {
        // Forward to existing cli-auth:login handler
        return ipcRenderer.invoke('cli-auth:login', options);
    },
    logout: async () => {
        // Forward to existing cli-auth:logout handler
        return ipcRenderer.invoke('cli-auth:logout');
    },
    check: async () => {
        // Forward to existing cli-auth:check handler
        return ipcRenderer.invoke('cli-auth:check');
    },
    getStatus: async () => {
        // Forward to existing cli-auth:status handler
        return ipcRenderer.invoke('cli-auth:status');
    },
    // ===== Token Management =====
    saveGitHubAuth: async (token, user) => {
        // Forward to existing secure-token:save-github-auth handler
        return ipcRenderer.invoke('secure-token:save-github-auth', token, user);
    },
    getGitHubAuth: async () => {
        // Forward to existing secure-token:get-github-auth handler
        return ipcRenderer.invoke('secure-token:get-github-auth');
    },
    clearGitHubAuth: async () => {
        // Forward to existing secure-token:clear-github-auth handler
        return ipcRenderer.invoke('secure-token:clear-github-auth');
    },
    isAuthenticated: async () => {
        // Forward to existing secure-token:is-authenticated handler
        return ipcRenderer.invoke('secure-token:is-authenticated');
    },
    // Generic token operations
    saveToken: async (key, token, metadata) => {
        // Forward to existing secure-token:set handler
        return ipcRenderer.invoke('secure-token:set', key, token, metadata);
    },
    getToken: async (key) => {
        // Forward to existing secure-token:get handler
        return ipcRenderer.invoke('secure-token:get', key);
    },
    deleteToken: async (key) => {
        // Forward to existing secure-token:delete handler
        return ipcRenderer.invoke('secure-token:delete', key);
    },
    migrateFromLocalStorage: async (tokens) => {
        // Forward to existing secure-token:migrate-from-localstorage handler
        return ipcRenderer.invoke('secure-token:migrate-from-localstorage', tokens);
    },
    // ===== State Management =====
    getAuthState: async () => {
        // Forward to existing auth-state:get handler
        return ipcRenderer.invoke('auth-state:get');
    },
    onAuthStateChanged: (callback) => {
        // Subscribe to auth state changes
        ipcRenderer.send('auth-state:subscribe');
        // Set up listener for state changes
        const listener = (_event, state) => {
            callback(state);
        };
        ipcRenderer.on('auth-state:changed', listener);
        // Return cleanup function
        return () => {
            ipcRenderer.send('auth-state:unsubscribe');
            ipcRenderer.removeListener('auth-state:changed', listener);
        };
    }
};
