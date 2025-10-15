/**
 * ObservabilityService - Frontend service for managing observability configuration
 */

export type StorageMode = 'none' | 'local' | 'local-with-sync';

export interface ObservabilityConfig {
  storageMode?: StorageMode;
  localDbPath?: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
  syncInterval?: number;
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

class ObservabilityServiceClass {
  /**
   * Get current observability configuration
   */
  async getConfiguration(): Promise<ObservabilityConfig> {
    const result = await window.mainProcess.observability.getConfig();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get configuration');
    }
    return result.config!;
  }

  /**
   * Save observability configuration
   */
  async saveConfiguration(config: ObservabilityConfig): Promise<void> {
    const result = await window.mainProcess.observability.saveConfig(config);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save configuration');
    }
  }

  /**
   * Test connection with provided configuration
   */
  async testConnection(
    config: ObservabilityConfig,
  ): Promise<ConnectionTestResult> {
    const result =
      await window.mainProcess.observability.testConnection(config);
    return result;
  }

  /**
   * Get current observability status and statistics
   */
  async getStatus(): Promise<ObservabilityStatus> {
    const result = await window.mainProcess.observability.getStatus();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get status');
    }
    return result.status!;
  }

  /**
   * Resolve a database path to its absolute path
   */
  async resolvePath(dbPath: string): Promise<string> {
    const result = await window.mainProcess.observability.resolvePath(dbPath);
    if (!result.success) {
      throw new Error(result.error || 'Failed to resolve path');
    }
    return result.resolvedPath!;
  }

  /**
   * Get the current database file path
   */
  async getDbPath(): Promise<string> {
    const result = await window.mainProcess.observability.getDbPath();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get database path');
    }
    return result.dbPath!;
  }

  /**
   * Open the database file location in Finder/Explorer
   */
  async openDbInFinder(): Promise<void> {
    const result = await window.mainProcess.observability.openDbInFinder();
    if (!result.success) {
      throw new Error(result.error || 'Failed to open in Finder');
    }
  }
}

export const ObservabilityService = new ObservabilityServiceClass();
