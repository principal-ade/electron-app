"use strict";
/**
 * LocalConfigAdapter - Uses bundled local JSON files
 * No external dependencies, works offline
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalConfigAdapter = void 0;
// Import the local JSON files
const default_layers_json_1 = __importDefault(require("../local/default-layers.json"));
const layer_templates_json_1 = __importDefault(require("../local/layer-templates.json"));
const scan_filters_json_1 = __importDefault(require("../local/scan-filters.json"));
const universal_gitignore_patterns_json_1 = __importDefault(require("../local/universal-gitignore-patterns.json"));
class LocalConfigAdapter {
    constructor() {
        this.configs = {
            'scan-filters.json': scan_filters_json_1.default,
            'default-layers.json': default_layers_json_1.default,
            'layer-templates.json': layer_templates_json_1.default,
            'universal-gitignore-patterns.json': universal_gitignore_patterns_json_1.default,
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
exports.LocalConfigAdapter = LocalConfigAdapter;
