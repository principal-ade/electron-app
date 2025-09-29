/**
 * AuthenticationAPI - Unified authentication interface for Electron app
 *
 * Consolidates OAuth authentication, secure token storage, and auth state management
 * into a single type-safe API interface.
 */

export interface AuthUser {
  login: string;
  email: string;
  name?: string;
  id?: number;
  avatarUrl?: string;
}

export interface AuthResult {
  success: boolean;
  authenticated?: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: string;
  email?: string;
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  lastChecked: number;
}

export interface TokenResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface TokenWithMetadata {
  authenticated: boolean;
  token?: string;
  user?: AuthUser;
}

export interface TokenMigrationEntry {
  key: string;
  value: unknown;
}

export interface AuthenticationAPI {
  // OAuth operations
  login(options?: { forceNew?: boolean }): Promise<AuthResult>;
  logout(): Promise<{ success: boolean; error?: string }>;
  check(): Promise<AuthResult>;
  getStatus(): Promise<AuthStatus>;

  // Token management
  saveGitHubAuth(
    token: string,
    user: AuthUser,
  ): Promise<{ success: boolean; error?: string }>;
  getGitHubAuth(): Promise<TokenWithMetadata>;
  clearGitHubAuth(): Promise<{ success: boolean; error?: string }>;
  isAuthenticated(): Promise<boolean>;

  // Generic token operations
  saveToken(
    key: string,
    token: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }>;
  getToken(key: string): Promise<TokenResult>;
  deleteToken(key: string): Promise<{ success: boolean; error?: string }>;
  migrateFromLocalStorage(
    tokens: TokenMigrationEntry[],
  ): Promise<{ success: boolean; error?: string }>;

  // State management
  getAuthState(): Promise<AuthState>;
  onAuthStateChanged(callback: (state: AuthState) => void): () => void;
}
