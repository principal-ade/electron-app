/**
 * Authentication IPC channel enums
 * Shared between main and renderer processes
 *
 * Note: Token-related events are defined in SecureTokenAPIEvent
 * This enum only contains OAuth and auth state management events
 */

export enum AuthEvent {
  // Session check events (auth is read from the gh CLI session)
  CHECK = 'cli-auth:check',
  STATUS = 'cli-auth:status',

  // Token metadata and validation operations
  GET_TOKEN_METADATA = 'cli-auth:get-token-metadata',
  VALIDATE_GITHUB_TOKEN = 'cli-auth:validate-github-token',

  // Keychain permission and status events
  CHECK_KEYCHAIN_STATUS = 'cli-auth:check-keychain-status',
  TEST_KEYCHAIN_ACCESS = 'cli-auth:test-keychain-access',

  // Keychain consent events (first-run permission flow)
  GET_KEYCHAIN_CONSENT = 'cli-auth:get-keychain-consent',
  SET_KEYCHAIN_CONSENT = 'cli-auth:set-keychain-consent',
  INITIALIZE_KEYCHAIN_AUTH = 'cli-auth:initialize-keychain-auth',

  // Auth state management events
  STATE_GET = 'auth-state:get',
  STATE_SUBSCRIBE = 'auth-state:subscribe',
  STATE_UNSUBSCRIBE = 'auth-state:unsubscribe',
  STATE_CHANGED = 'auth-state:changed',
}
