/**
 * ConfigLoader - Core configuration loading and processing
 * Uses adapters for fetching, handles validation and caching
 */
import { ConfigFetchAdapter } from './adapters/ConfigFetchAdapter';
import { ConfigSource, ConfigType, ScanFilterConfig, DefaultLayersConfig, LayerTemplateConfig } from './types';
export interface ConfigLoaderOptions {
    adapter?: ConfigFetchAdapter;
    source?: ConfigSource;
    cacheTTL?: number;
    validateConfigs?: boolean;
    fallbackToDefaults?: boolean;
    useLocalByDefault?: boolean;
}
export declare class ConfigLoader {
    private adapter;
    private source;
    private cache;
    private cacheTTL;
    private validateConfigs;
    private fallbackToDefaults;
    constructor(options?: ConfigLoaderOptions);
    /**
     * Load scan filters configuration
     */
    loadScanFilters(source?: ConfigSource): Promise<ScanFilterConfig>;
    /**
     * Load default layers configuration
     */
    loadDefaultLayers(source?: ConfigSource): Promise<DefaultLayersConfig>;
    /**
     * Load layer templates configuration
     */
    loadLayerTemplates(source?: ConfigSource): Promise<LayerTemplateConfig>;
    /**
     * Load all configurations at once
     */
    loadAllConfigs(source?: ConfigSource): Promise<{
        scanFilters: ScanFilterConfig;
        defaultLayers: DefaultLayersConfig;
        layerTemplates: LayerTemplateConfig;
    }>;
    /**
     * Generic config loading with caching and validation
     */
    private loadConfig;
    /**
     * Clear cache for specific config or all configs
     */
    clearCache(configType?: ConfigType): void;
    /**
     * Update the source for future loads
     */
    setSource(source: ConfigSource): void;
    /**
     * Get current source
     */
    getSource(): ConfigSource;
    private getCacheKey;
    private getFromCache;
    private setCache;
}
