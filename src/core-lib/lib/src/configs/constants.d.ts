/**
 * Configuration constants for Specktor configuration files
 * These are used across the monorepo for fetching and loading configurations
 */
export declare const SPECKTOR_GITHUB_CONFIG: {
    readonly owner: "a24z-ai";
    readonly repo: "specktor-configurations";
    readonly branch: "main";
    readonly files: {
        readonly scanFilters: "scan-filters.json";
        readonly layerTemplates: "layer-templates.json";
        readonly defaultLayers: "default-layers.json";
    };
};
/**
 * Build a raw GitHub URL for a configuration file
 */
export declare function getGitHubConfigUrl(filename: string): string;
/**
 * Get all configuration URLs
 */
export declare function getAllConfigUrls(): Record<string, string>;
/**
 * Configuration source options
 */
export interface ConfigSourceOptions {
    preferGitHub?: boolean;
    cacheTimeout?: number;
    fallbackToLocal?: boolean;
}
/**
 * Default configuration options
 */
export declare const DEFAULT_CONFIG_OPTIONS: ConfigSourceOptions;
export type ConfigFileName = (typeof SPECKTOR_GITHUB_CONFIG.files)[keyof typeof SPECKTOR_GITHUB_CONFIG.files];
//# sourceMappingURL=constants.d.ts.map