/**
 * Observability IPC channel enums
 * Shared between main and renderer processes
 */

export enum ObservabilityEvent {
  GET_CONFIG = 'observability:getConfig',
  SAVE_CONFIG = 'observability:saveConfig',
  TEST_CONNECTION = 'observability:testConnection',
  GET_STATUS = 'observability:getStatus',
  RESOLVE_PATH = 'observability:resolvePath',
  OPEN_DB_IN_FINDER = 'observability:openDbInFinder',
  GET_DB_PATH = 'observability:getDbPath',
}
