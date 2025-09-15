/**
 * ConfigFetchAdapter - Interface for platform-specific config fetching
 * Each platform (electron, vscode, web) implements this to fetch configs their own way
 */
import { ConfigSource } from '../types';
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
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
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
/**
 * In-memory adapter for testing
 */
export declare class InMemoryConfigAdapter implements ConfigFetchAdapter {
    private configs;
    constructor(configs?: Record<string, any>);
    fetchConfig(fileName: string, source: ConfigSource): Promise<ConfigFetchResult>;
    configExists(fileName: string): Promise<boolean>;
    listConfigs(): Promise<string[]>;
    setConfig(fileName: string, content: any): void;
}
