/**
 * Authentication Provider
 *
 * This module provides authentication endpoints for WorkOS.
 */

export interface AuthEndpoints {
  start: string;
  callback: string;
  token: string;
}

/**
 * Get authentication endpoints for WorkOS
 */
export function getAuthEndpoints(baseUrl: string): AuthEndpoints {
  return {
    start: `${baseUrl}/api/auth/workos/start`,
    callback: `${baseUrl}/api/auth/workos/callback`,
    token: `${baseUrl}/api/auth/workos/token`,
  };
}

/**
 * Get the authentication provider name for logging
 */
export function getAuthProviderName(): string {
  return 'WorkOS';
}
