/**
 * ConfigLoader - Core configuration loading and processing
 * Uses adapters for fetching, handles validation and caching
 */
import { LocalConfigAdapter } from './adapters/LocalConfigAdapter';
import { getDefaultConfig } from './defaults';
import { CONFIG_FILES, OFFICIAL_CONFIG_SOURCE, } from './types';
import { ConfigValidator } from './validators/ConfigValidator';
export class ConfigLoader {
    constructor(options = {}) {
        this.cache = new Map();
        // Use LocalConfigAdapter by default if no adapter provided
        this.adapter = options.adapter || new LocalConfigAdapter();
        // If useLocalByDefault is true, always use local source
        this.source = options.useLocalByDefault
            ? { type: 'local', localPath: 'bundled' }
            : options.source || OFFICIAL_CONFIG_SOURCE;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
        this.validateConfigs = options.validateConfigs !== false; // Default true
        this.fallbackToDefaults = options.fallbackToDefaults !== false; // Default true
    }
    /**
     * Load scan filters configuration
     */
    async loadScanFilters(source) {
        return this.loadConfig('scanFilters', source);
    }
    /**
     * Load default layers configuration
     */
    async loadDefaultLayers(source) {
        return this.loadConfig('defaultLayers', source);
    }
    /**
     * Load layer templates configuration
     */
    async loadLayerTemplates(source) {
        return this.loadConfig('layerTemplates', source);
    }
    /**
     * Load all configurations at once
     */
    async loadAllConfigs(source) {
        const [scanFilters, defaultLayers, layerTemplates] = await Promise.all([
            this.loadScanFilters(source),
            this.loadDefaultLayers(source),
            this.loadLayerTemplates(source),
        ]);
        return { scanFilters, defaultLayers, layerTemplates };
    }
    /**
     * Generic config loading with caching and validation
     */
    async loadConfig(configType, source) {
        const fileName = CONFIG_FILES[configType];
        const configSource = source || this.source;
        const cacheKey = this.getCacheKey(fileName, configSource);
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`[ConfigLoader] Using cached ${fileName}`);
            return cached;
        }
        try {
            // Fetch from adapter
            console.log(`[ConfigLoader] Fetching ${fileName} from ${configSource.type}`);
            const result = await this.adapter.fetchConfig(fileName, configSource);
            // Parse JSON
            const data = JSON.parse(result.content);
            // Validate if enabled
            if (this.validateConfigs) {
                const isValid = ConfigValidator.validate(configType, data);
                if (!isValid) {
                    throw new Error(`Invalid ${fileName} configuration`);
                }
            }
            // Cache the result
            this.setCache(cacheKey, data, result);
            return data;
        }
        catch (error) {
            console.error(`[ConfigLoader] Failed to load ${fileName}:`, error);
            if (this.fallbackToDefaults) {
                console.log(`[ConfigLoader] Falling back to default ${fileName}`);
                const defaultConfig = getDefaultConfig(configType);
                // Create a synthetic result for the default
                const syntheticResult = {
                    content: JSON.stringify(defaultConfig),
                    source: { type: 'inline', data: defaultConfig },
                    timestamp: Date.now(),
                };
                this.setCache(cacheKey, defaultConfig, syntheticResult);
                return defaultConfig;
            }
            throw error;
        }
    }
    /**
     * Clear cache for specific config or all configs
     */
    clearCache(configType) {
        if (configType) {
            const fileName = CONFIG_FILES[configType];
            // Clear all cache entries for this config type
            for (const key of this.cache.keys()) {
                if (key.includes(fileName)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    /**
     * Update the source for future loads
     */
    setSource(source) {
        this.source = source;
        // Clear cache when source changes
        this.clearCache();
    }
    /**
     * Get current source
     */
    getSource() {
        return this.source;
    }
    // Cache management helpers
    getCacheKey(fileName, source) {
        const sourceKey = source.type === 'github'
            ? `${source.type}:${source.owner}/${source.repo}/${source.branch}`
            : source.type === 'local'
                ? `${source.type}:${source.localPath}`
                : source.type === 'url'
                    ? `${source.type}:${source.url}`
                    : `${source.type}:inline`;
        return `${fileName}:${sourceKey}`;
    }
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    setCache(key, data, result) {
        this.cache.set(key, {
            data,
            result,
            expiresAt: Date.now() + this.cacheTTL,
        });
    }
}
