/**
 * SecureTokenAPI - Type-safe interface for secure token storage operations
 *
 * Provides IPC event constants and interfaces for token management
 * using Electron's safeStorage API with OS keychain integration.
 */

import type { AuthUser } from './AuthenticationAPI';

export enum SecureTokenAPIEvent {
  // GitHub-specific operations
  SAVE_GITHUB_AUTH = 'secure-token:save-github-auth',
  GET_GITHUB_AUTH = 'secure-token:get-github-auth',
  CLEAR_GITHUB_AUTH = 'secure-token:clear-github-auth',
  IS_AUTHENTICATED = 'secure-token:is-authenticated',

  // Generic token operations
  SET = 'secure-token:set',
  GET = 'secure-token:get',
  DELETE = 'secure-token:delete',

  // Migration
  MIGRATE_FROM_LOCALSTORAGE = 'secure-token:migrate-from-localstorage',
}

export interface SecureTokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface AuthTokenWithMetadata {
  authenticated: boolean;
  token?: string;
  user?: AuthUser;
}
