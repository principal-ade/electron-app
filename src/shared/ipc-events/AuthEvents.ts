/**
 * Authentication IPC channel enums
 * Shared between main and renderer processes
 *
 * Note: Token-related events are defined in SecureTokenAPIEvent
 * This enum only contains OAuth and auth state management events
 */

export enum AuthEvent {
  // OAuth authentication events
  LOGIN = 'cli-auth:login',
  LOGOUT = 'cli-auth:logout',
  CHECK = 'cli-auth:check',
  STATUS = 'cli-auth:status',

  // Token metadata and refresh operations
  GET_TOKEN_METADATA = 'cli-auth:get-token-metadata',
  TEST_REFRESH_TOKEN = 'cli-auth:test-refresh-token',

  // Auth state management events
  STATE_GET = 'auth-state:get',
  STATE_SUBSCRIBE = 'auth-state:subscribe',
  STATE_UNSUBSCRIBE = 'auth-state:unsubscribe',
  STATE_CHANGED = 'auth-state:changed',
}
