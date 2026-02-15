/**
 * Observability API Interface
 */

export type StorageMode = 'none' | 'local' | 'local-with-sync';

export interface ObservabilityConfig {
  storageMode?: StorageMode;
  localDbPath?: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
  syncInterval?: number;
  environment?: 'development' | 'staging' | 'production';
  enabled?: boolean;
}

export interface ObservabilityStatus {
  isInitialized: boolean;
  eventCount: number;
  errorCount: number;
  errorRate: number;
  enabled: boolean;
  hasConfig: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

export interface ObservabilityAPI {
  /**
   * Get current observability configuration
   */
  getConfig(): Promise<{
    success: boolean;
    config?: ObservabilityConfig;
    error?: string;
  }>;

  /**
   * Save observability configuration
   */
  saveConfig(
    config: ObservabilityConfig,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Test connection with provided configuration
   */
  testConnection(config: ObservabilityConfig): Promise<ConnectionTestResult>;

  /**
   * Get observability status and statistics
   */
  getStatus(): Promise<{
    success: boolean;
    status?: ObservabilityStatus;
    error?: string;
  }>;

  /**
   * Resolve a database path to its absolute path
   */
  resolvePath(dbPath: string): Promise<{
    success: boolean;
    resolvedPath?: string;
    error?: string;
  }>;

  /**
   * Get the current database file path
   */
  getDbPath(): Promise<{
    success: boolean;
    dbPath?: string;
    error?: string;
  }>;

  /**
   * Open the database file location in Finder/Explorer
   */
  openDbInFinder(): Promise<{ success: boolean; error?: string }>;
}
