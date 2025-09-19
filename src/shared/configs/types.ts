/**
 * Configuration type definitions
 * These types are used for config fetching and management across the application
 * Kept together for potential extraction to a separate package
 */

// ============================================================================
// Configuration Source
// ============================================================================

export interface ConfigSource {
  type: 'github' | 'local' | 'url' | 'inline';
  // For GitHub
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string;
  // For local
  localPath?: string;
  // For URL
  url?: string;
  // For inline
  content?: string;
}

// ============================================================================
// Config Fetch Adapter
// ============================================================================

export interface ConfigFetchResult {
  content: string;
  source: ConfigSource;
  timestamp: number;
  cached?: boolean;
}

export interface ConfigFetchAdapter {
  /**
   * Fetch configuration content from a source
   * @param fileName - Name of the config file (e.g., 'scan-filters.json')
   * @param source - Where to fetch from (GitHub, local, URL, etc.)
   * @returns The raw config content as a string
   */
  fetchConfig(
    fileName: string,
    source: ConfigSource,
  ): Promise<ConfigFetchResult>;

  /**
   * Check if a config exists at the source
   * @param fileName - Name of the config file
   * @param source - Where to check
   * @returns True if the config exists
   */
  configExists?(fileName: string, source: ConfigSource): Promise<boolean>;

  /**
   * Get all available configs from a source
   * @param source - Where to list configs from
   * @returns List of available config file names
   */
  listConfigs?(source: ConfigSource): Promise<string[]>;
}
