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

/**
 * Where the GitHub credentials came from.
 * `gh-cli` means the GitHub CLI is installed and signed in
 * (`gh auth token` succeeded); `stored-token` is the local fallback.
 */
export type AuthTokenSource = 'gh-cli' | 'stored-token';

export interface AuthResult {
  success: boolean;
  authenticated?: boolean;
  token?: string;
  user?: AuthUser;
  source?: AuthTokenSource;
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

export interface TokenMetadata {
  hasToken: boolean;
  hasRefreshToken: boolean;
  expiresAt?: number;
  expiresAtFormatted?: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  timeUntilExpiry?: string;
  user?: AuthUser;
}

export interface AuthenticationAPI {
  // Session operations (read-only — auth comes from the gh CLI session)
  check(): Promise<AuthResult>;
  getStatus(): Promise<AuthStatus>;

  // Token management
  getGitHubAuth(): Promise<TokenWithMetadata>;
  isAuthenticated(): Promise<boolean>;

  // Token metadata and validation
  getTokenMetadata(): Promise<TokenMetadata>;
  validateGitHubToken(): Promise<{
    valid: boolean;
    tokenPresent: boolean;
    tokenPrefix?: string;
    error?: string;
    statusCode?: number;
  }>;

  // Generic token operations
  saveToken(
    key: string,
    token: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }>;
  getToken(key: string): Promise<TokenResult>;
  deleteToken(key: string): Promise<{ success: boolean; error?: string }>;

  // State management
  getAuthState(): Promise<AuthState>;
  onAuthStateChanged(callback: (state: AuthState) => void): () => void;

  // Keychain operations
  checkKeychainStatus(): Promise<{
    available: boolean;
    initialized: boolean;
    error?: string;
    errorType?: string;
  }>;
  testKeychainAccess(): Promise<{
    success: boolean;
    error?: string;
    errorType?: string;
  }>;

  // Keychain consent (first-run permission flow)
  getKeychainConsent(): Promise<{
    status: 'pending' | 'granted' | 'declined';
    decidedAt?: number;
  }>;
  setKeychainConsent(consent: {
    status: 'pending' | 'granted' | 'declined';
  }): Promise<{ success: boolean; error?: string }>;
  initializeKeychainAuth(): Promise<{ success: boolean; error?: string }>;
}
