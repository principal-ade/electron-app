/**
 * ScanFilterProcessor - Processes scan filter configs for use by filesystem services
 * Converts config format to runtime format needed by various consumers
 */
// Note: FilterLayer type removed - using FileSystemFilterLayer from layers/types instead
export class ScanFilterProcessor {
    /**
     * Convert scan filter config to mandatory filters for FilesystemService
     * Only returns enabled filters marked as mandatory or performance-critical
     */
    static toMandatoryFilters(config) {
        const mandatoryFilters = [];
        for (const filter of config.filters) {
            if (!filter.enabled)
                continue;
            // Only include performance filters as mandatory
            // Security and relevance filters can be optional
            if (filter.purpose !== 'performance')
                continue;
            for (const pattern of filter.patterns) {
                mandatoryFilters.push({
                    pattern: pattern.pattern,
                    type: pattern.type,
                    reason: filter.description || filter.name,
                    generateWarning: !!filter.generateWarning,
                });
            }
        }
        return mandatoryFilters;
    }
    /**
     * Convert scan filter config to filter layers for layer system
     */
    static toFilterLayers(config) {
        const filterLayers = [];
        for (const filter of config.filters) {
            // Create a filter layer for each filter definition
            const filterLayer = {
                id: filter.id,
                name: filter.name,
                type: 'filter',
                enabled: filter.enabled,
                derivedFrom: {
                    fileSets: [],
                    derivationType: 'presence',
                    description: filter.description || `Filter for ${filter.name}`,
                },
                filterData: {
                    purpose: filter.purpose,
                    scope: 'directory', // Changed from 'global' to 'directory'
                    sourceDirectory: '', // Config filters apply from root
                    excludedPatterns: filter.patterns.map(p => ({
                        type: p.type,
                        pattern: p.pattern,
                        description: filter.description,
                    })),
                },
            };
            filterLayers.push(filterLayer);
        }
        return filterLayers;
    }
    /**
     * Get only enabled filters
     */
    static getEnabledFilters(config) {
        return config.filters.filter(f => f.enabled);
    }
    /**
     * Get filters by purpose
     */
    static getFiltersByPurpose(config, purpose) {
        return config.filters.filter(f => f.enabled && f.purpose === purpose);
    }
    /**
     * Merge multiple configs (useful for combining default + custom)
     */
    static mergeConfigs(...configs) {
        if (configs.length === 0) {
            throw new Error('No configs provided to merge');
        }
        // Use the version from the first config
        const merged = {
            version: configs[0].version,
            description: configs[0].description,
            filters: [],
        };
        // Track filter IDs to avoid duplicates
        const filterIds = new Set();
        for (const config of configs) {
            for (const filter of config.filters) {
                // Skip if we already have this filter ID
                if (filterIds.has(filter.id))
                    continue;
                filterIds.add(filter.id);
                merged.filters.push(filter);
            }
        }
        return merged;
    }
    /**
     * Apply filter overrides (e.g., from user preferences)
     */
    static applyOverrides(config, overrides) {
        const result = { ...config, filters: [...config.filters] };
        for (let i = 0; i < result.filters.length; i++) {
            const filter = result.filters[i];
            const override = overrides[filter.id];
            if (override) {
                result.filters[i] = {
                    ...filter,
                    enabled: override.enabled !== undefined ? override.enabled : filter.enabled,
                    patterns: override.patterns || filter.patterns,
                };
            }
        }
        return result;
    }
    /**
     * Expand patterns (e.g., convert simplified patterns to full format)
     */
    static expandPatterns(patterns) {
        return patterns.map(pattern => {
            // Detect pattern type based on content
            let type = 'glob';
            if (pattern.includes('*') || pattern.includes('?')) {
                type = 'glob';
            }
            else if (pattern.startsWith('^') || pattern.includes('\\') || pattern.includes('$')) {
                type = 'regex';
            }
            else if (!pattern.includes('/')) {
                type = 'exact';
            }
            return { type, pattern };
        });
    }
    /**
     * Validate that all required filters are present
     */
    static validateRequiredFilters(config) {
        // Define critical filters that should always be present
        const requiredFilterIds = [
            'scan-filter-git-objects', // Git internals
            'scan-filter-dependencies', // node_modules, vendor, etc.
        ];
        const presentIds = new Set(config.filters.map(f => f.id));
        const missing = requiredFilterIds.filter(id => !presentIds.has(id));
        return {
            valid: missing.length === 0,
            missing,
        };
    }
}
//# sourceMappingURL=ScanFilterProcessor.js.map