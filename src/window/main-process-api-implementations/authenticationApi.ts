/**
 * AuthenticationAPI implementation for preload script
 *
 * This implementation wraps existing IPC channels to provide a unified
 * authentication interface. During migration, it forwards calls to the
 * existing handlers in AuthService, AuthStateManager, and SecureTokenIPC.
 */

import { ipcRenderer } from 'electron';
import type {
  AuthenticationAPI,
  AuthResult,
  AuthStatus,
  AuthState,
  AuthUser,
  TokenResult,
  TokenWithMetadata,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';

export const authenticationAPI: AuthenticationAPI = {
  // ===== OAuth Operations =====

  login: async (options?: { forceNew?: boolean }): Promise<AuthResult> => {
    // Forward to existing cli-auth:login handler
    return ipcRenderer.invoke('cli-auth:login', options);
  },

  logout: async (): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing cli-auth:logout handler
    return ipcRenderer.invoke('cli-auth:logout');
  },

  check: async (): Promise<AuthResult> => {
    // Forward to existing cli-auth:check handler
    return ipcRenderer.invoke('cli-auth:check');
  },

  getStatus: async (): Promise<AuthStatus> => {
    // Forward to existing cli-auth:status handler
    return ipcRenderer.invoke('cli-auth:status');
  },

  // ===== Token Management =====

  saveGitHubAuth: async (
    token: string,
    user: AuthUser,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:save-github-auth handler
    return ipcRenderer.invoke('secure-token:save-github-auth', token, user);
  },

  getGitHubAuth: async (): Promise<TokenWithMetadata> => {
    // Forward to existing secure-token:get-github-auth handler
    return ipcRenderer.invoke('secure-token:get-github-auth');
  },

  clearGitHubAuth: async (): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:clear-github-auth handler
    return ipcRenderer.invoke('secure-token:clear-github-auth');
  },

  isAuthenticated: async (): Promise<boolean> => {
    // Forward to existing secure-token:is-authenticated handler
    return ipcRenderer.invoke('secure-token:is-authenticated');
  },

  // Generic token operations
  saveToken: async (
    key: string,
    token: string,
    metadata?: any,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:set handler
    return ipcRenderer.invoke('secure-token:set', key, token, metadata);
  },

  getToken: async (key: string): Promise<TokenResult> => {
    // Forward to existing secure-token:get handler
    return ipcRenderer.invoke('secure-token:get', key);
  },

  deleteToken: async (
    key: string,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:delete handler
    return ipcRenderer.invoke('secure-token:delete', key);
  },

  migrateFromLocalStorage: async (
    tokens: any[],
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:migrate-from-localstorage handler
    return ipcRenderer.invoke('secure-token:migrate-from-localstorage', tokens);
  },

  // ===== State Management =====

  getAuthState: async (): Promise<AuthState> => {
    // Forward to existing auth-state:get handler
    return ipcRenderer.invoke('auth-state:get');
  },

  onAuthStateChanged: (callback: (state: AuthState) => void): (() => void) => {
    // Subscribe to auth state changes
    ipcRenderer.send('auth-state:subscribe');

    // Set up listener for state changes
    const listener = (_event: any, state: AuthState) => {
      callback(state);
    };

    ipcRenderer.on('auth-state:changed', listener);

    // Return cleanup function
    return () => {
      ipcRenderer.send('auth-state:unsubscribe');
      ipcRenderer.removeListener('auth-state:changed', listener);
    };
  },
};
