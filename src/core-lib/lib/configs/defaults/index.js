"use strict";
/**
 * Default configurations - Fallback when configs can't be fetched
 * These match the structure of configs from Voyager-Guides
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LAYER_TEMPLATES = exports.DEFAULT_LAYERS = exports.DEFAULT_SCAN_FILTERS = void 0;
exports.getDefaultConfig = getDefaultConfig;
exports.DEFAULT_SCAN_FILTERS = {
    version: '1.0',
    description: 'Default file system filters for performance optimization',
    filters: [
        {
            id: 'scan-filter-git-objects',
            name: 'Git Internal Objects',
            enabled: true,
            purpose: 'performance',
            description: 'Exclude git internal object storage',
            patterns: [
                { type: 'glob', pattern: '.git/objects/**' },
                { type: 'glob', pattern: '.git/logs/**' },
                { type: 'glob', pattern: '.git/refs/**' },
                { type: 'glob', pattern: '.git/hooks/**' },
            ],
        },
        {
            id: 'scan-filter-dependencies',
            name: 'Package Dependencies',
            enabled: true,
            purpose: 'performance',
            description: 'Exclude package manager dependency directories',
            patterns: [
                { type: 'glob', pattern: 'node_modules/**' },
                { type: 'glob', pattern: '**/node_modules/**' },
                { type: 'glob', pattern: 'vendor/**' },
                { type: 'glob', pattern: '**/vendor/**' },
            ],
        },
        {
            id: 'scan-filter-build-outputs',
            name: 'Build Outputs',
            enabled: true,
            purpose: 'performance',
            description: 'Exclude common build output directories',
            patterns: [
                { type: 'glob', pattern: 'dist/**' },
                { type: 'glob', pattern: 'build/**' },
                { type: 'glob', pattern: 'out/**' },
                { type: 'glob', pattern: 'target/**' },
                { type: 'glob', pattern: '.next/**' },
            ],
        },
        {
            id: 'scan-filter-cache',
            name: 'Cache Directories',
            enabled: true,
            purpose: 'performance',
            description: 'Exclude cache and temporary directories',
            patterns: [
                { type: 'glob', pattern: '.cache/**' },
                { type: 'glob', pattern: '**/cache/**' },
                { type: 'glob', pattern: 'tmp/**' },
                { type: 'glob', pattern: 'temp/**' },
            ],
        },
        {
            id: 'scan-filter-test-coverage',
            name: 'Test Coverage',
            enabled: true,
            purpose: 'performance',
            description: 'Exclude test coverage reports',
            patterns: [
                { type: 'glob', pattern: 'coverage/**' },
                { type: 'glob', pattern: '.nyc_output/**' },
                { type: 'glob', pattern: '**/*.lcov' },
            ],
        },
    ],
};
exports.DEFAULT_LAYERS = {
    version: '1.0.0',
    description: 'Default layer definitions for project visualization',
    layers: [
        {
            id: 'layer-git',
            name: 'Version Control',
            type: 'vcs',
            category: 'infrastructure',
            patterns: [
                { type: 'glob', pattern: '.git/**', description: 'Git repository data' },
                { type: 'glob', pattern: '.gitignore', description: 'Git ignore rules' },
                { type: 'glob', pattern: '.gitattributes', description: 'Git attributes' },
            ],
            scope: 'repository',
            enabled: true,
            color: '#f1502f',
            icon: 'git',
        },
        {
            id: 'layer-docs',
            name: 'Documentation',
            type: 'documentation',
            category: 'documentation',
            patterns: [
                { type: 'glob', pattern: 'README*', description: 'README files' },
                { type: 'glob', pattern: '*.md', description: 'Markdown documentation' },
                { type: 'glob', pattern: 'docs/**', description: 'Documentation directory' },
                { type: 'glob', pattern: 'LICENSE*', description: 'License files' },
            ],
            scope: 'repository',
            enabled: true,
            color: '#00bcd4',
            icon: 'book',
        },
        {
            id: 'layer-config',
            name: 'Configuration',
            type: 'config',
            category: 'infrastructure',
            patterns: [
                { type: 'glob', pattern: '*.json', description: 'JSON configs' },
                { type: 'glob', pattern: '*.yml', description: 'YAML configs' },
                { type: 'glob', pattern: '*.yaml', description: 'YAML configs' },
                { type: 'glob', pattern: '*.toml', description: 'TOML configs' },
                { type: 'glob', pattern: '.*rc', description: 'RC files' },
            ],
            scope: 'workspace',
            enabled: true,
            color: '#9c27b0',
            icon: 'settings',
        },
        {
            id: 'layer-tests',
            name: 'Tests',
            type: 'test',
            category: 'quality',
            patterns: [
                { type: 'glob', pattern: '**/*.test.*', description: 'Test files' },
                { type: 'glob', pattern: '**/*.spec.*', description: 'Spec files' },
                { type: 'glob', pattern: '**/test/**', description: 'Test directories' },
                { type: 'glob', pattern: '**/tests/**', description: 'Tests directories' },
                { type: 'glob', pattern: '**/__tests__/**', description: 'Jest test directories' },
            ],
            scope: 'workspace',
            enabled: true,
            color: '#4caf50',
            icon: 'check',
        },
    ],
};
exports.DEFAULT_LAYER_TEMPLATES = {
    version: '1.0',
    description: 'Default templates for dynamic layer generation',
    templates: [
        {
            id: 'template-dependencies',
            name: 'Dependencies Template',
            description: 'Generate dependency layers from package.json',
            sourceFile: 'package.json',
            contentParser: 'json',
            layerTemplate: {
                type: 'dependency',
                category: 'dependencies',
                derivationType: 'content',
            },
            outputMapping: [
                {
                    layerProperty: 'name',
                    sourceProperty: 'name',
                },
                {
                    layerProperty: 'version',
                    sourceProperty: 'version',
                },
                {
                    layerProperty: 'dependencies',
                    sourceProperty: 'dependencies',
                },
            ],
        },
    ],
};
/**
 * Get default configuration by type
 */
function getDefaultConfig(configType) {
    switch (configType) {
        case 'scanFilters':
            return exports.DEFAULT_SCAN_FILTERS;
        case 'defaultLayers':
            return exports.DEFAULT_LAYERS;
        case 'layerTemplates':
            return exports.DEFAULT_LAYER_TEMPLATES;
        default:
            throw new Error(`Unknown config type: ${configType}`);
    }
}
