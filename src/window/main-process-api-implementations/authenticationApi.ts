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
  TokenMigrationEntry,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';
import { AuthEvent } from '../../shared/ipc-events/AuthEvents';
import { SecureTokenAPIEvent } from '../../shared/main-process-api-interfaces/SecureTokenAPI';

export const authenticationAPI: AuthenticationAPI = {
  // ===== OAuth Operations =====

  login: async (options?: { forceNew?: boolean }): Promise<AuthResult> => {
    // Forward to existing cli-auth:login handler
    return ipcRenderer.invoke(AuthEvent.LOGIN, options);
  },

  logout: async (): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing cli-auth:logout handler
    return ipcRenderer.invoke(AuthEvent.LOGOUT);
  },

  check: async (): Promise<AuthResult> => {
    // Forward to existing cli-auth:check handler
    return ipcRenderer.invoke(AuthEvent.CHECK);
  },

  getStatus: async (): Promise<AuthStatus> => {
    // Forward to existing cli-auth:status handler
    return ipcRenderer.invoke(AuthEvent.STATUS);
  },

  // ===== Token Management =====

  saveGitHubAuth: async (
    token: string,
    user: AuthUser,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:save-github-auth handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.SAVE_GITHUB_AUTH, token, user);
  },

  getGitHubAuth: async (): Promise<TokenWithMetadata> => {
    // Forward to existing secure-token:get-github-auth handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.GET_GITHUB_AUTH);
  },

  clearGitHubAuth: async (): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:clear-github-auth handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.CLEAR_GITHUB_AUTH);
  },

  isAuthenticated: async (): Promise<boolean> => {
    // Forward to existing secure-token:is-authenticated handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.IS_AUTHENTICATED);
  },

  // Generic token operations
  saveToken: async (
    key: string,
    token: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:set handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.SET, key, token, metadata);
  },

  getToken: async (key: string): Promise<TokenResult> => {
    // Forward to existing secure-token:get handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.GET, key);
  },

  deleteToken: async (
    key: string,
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:delete handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.DELETE, key);
  },

  migrateFromLocalStorage: async (
    tokens: TokenMigrationEntry[],
  ): Promise<{ success: boolean; error?: string }> => {
    // Forward to existing secure-token:migrate-from-localstorage handler
    return ipcRenderer.invoke(SecureTokenAPIEvent.MIGRATE_FROM_LOCALSTORAGE, tokens);
  },

  // ===== State Management =====

  getAuthState: async (): Promise<AuthState> => {
    // Forward to existing auth-state:get handler
    return ipcRenderer.invoke(AuthEvent.STATE_GET);
  },

  onAuthStateChanged: (callback: (state: AuthState) => void): (() => void) => {
    // Subscribe to auth state changes
    ipcRenderer.send(AuthEvent.STATE_SUBSCRIBE);

    // Set up listener for state changes
    const listener = (_event: unknown, state: AuthState) => {
      callback(state);
    };

    ipcRenderer.on(AuthEvent.STATE_CHANGED, listener);

    // Return cleanup function
    return () => {
      ipcRenderer.send(AuthEvent.STATE_UNSUBSCRIBE);
      ipcRenderer.removeListener(AuthEvent.STATE_CHANGED, listener);
    };
  },
};
