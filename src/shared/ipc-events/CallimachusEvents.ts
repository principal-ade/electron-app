import type {
  CallimachusConfig,
  SearchOptions,
  SearchResult,
  BrowseFilters,
  BrowseResult,
  AlexandriaLayout
} from '@a24z/callimachus';

export enum CallimachusEvents {
  // Window Management
  OPEN_WINDOW = 'callimachus:open-window',
  CLOSE_WINDOW = 'callimachus:close-window',

  // Connection Management
  TEST_CONNECTION = 'callimachus:test-connection',
  SAVE_CONNECTION = 'callimachus:save-connection',
  GET_CONNECTION = 'callimachus:get-connection',

  // Search Operations
  SEARCH = 'callimachus:search',
  BROWSE = 'callimachus:browse',
  GET_PATTERN_DETAILS = 'callimachus:get-pattern-details',
  GET_RECENT_SEARCHES = 'callimachus:get-recent-searches',

  // Pattern Management
  INGEST_REPOSITORY = 'callimachus:ingest-repository',
  GET_INGESTED_PATTERNS = 'callimachus:get-ingested-patterns',

  // Status Updates
  CONNECTION_STATUS = 'callimachus:connection-status',
  SEARCH_STATUS = 'callimachus:search-status',
}

// Extended types for our electron app
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount: number;
}

// Re-export types from SDK for convenience
export type {
  CallimachusConfig,
  SearchOptions,
  SearchResult,
  BrowseFilters,
  BrowseResult,
  AlexandriaLayout
};