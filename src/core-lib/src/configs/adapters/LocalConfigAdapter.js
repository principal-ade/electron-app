/**
 * LocalConfigAdapter - Uses bundled local JSON files
 * No external dependencies, works offline
 */
// Import the local JSON files
import defaultLayers from '../local/default-layers.json';
import layerTemplates from '../local/layer-templates.json';
import scanFilters from '../local/scan-filters.json';
import universalGitignorePatterns from '../local/universal-gitignore-patterns.json';
export class LocalConfigAdapter {
    constructor() {
        this.configs = {
            'scan-filters.json': scanFilters,
            'default-layers.json': defaultLayers,
            'layer-templates.json': layerTemplates,
            'universal-gitignore-patterns.json': universalGitignorePatterns,
        };
    }
    async fetchConfig(fileName, _source) {
        // Always use local configs regardless of source
        const config = this.configs[fileName];
        if (!config) {
            throw new Error(`Local config not found: ${fileName}`);
        }
        return {
            content: JSON.stringify(config),
            source: { type: 'local', localPath: 'bundled' },
            timestamp: Date.now(),
            cached: false,
        };
    }
    async configExists(fileName, _source) {
        return fileName in this.configs;
    }
    async listConfigs(_source) {
        return Object.keys(this.configs);
    }
}
