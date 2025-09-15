/**
 * Configuration type definitions for layer system
 * These types define the structure of configs fetched from Voyager-Guides
 */
export interface ScanFilterPattern {
    type: 'glob' | 'regex' | 'exact';
    pattern: string;
}
export interface ScanFilterWarning {
    layerId: string;
    layerName: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    recommendation?: string;
    impact?: string;
}
export interface ScanFilterDefinition {
    id: string;
    name: string;
    enabled: boolean;
    purpose: 'performance' | 'security' | 'relevance';
    sourceDirectory?: string;
    description?: string;
    patterns: ScanFilterPattern[];
    generateWarning?: ScanFilterWarning;
}
export interface ScanFilterConfig {
    version: string;
    description?: string;
    filters: ScanFilterDefinition[];
}
export interface LayerPattern {
    type: 'glob' | 'regex' | 'exact';
    pattern: string;
    description?: string;
}
export interface LayerDefinition {
    id: string;
    name: string;
    type: string;
    category: string;
    patterns: LayerPattern[];
    scope?: 'repository' | 'workspace' | 'directory';
    enabled?: boolean;
    color?: string;
    icon?: string;
    description?: string;
}
export interface LayerSection {
    id: string;
    name: string;
    description?: string;
    layers: LayerDefinition[];
}
export interface DefaultLayersConfig {
    version: string;
    description?: string;
    repositoryWide?: LayerSection[];
    workspaceScoped?: LayerSection[];
    layers?: LayerDefinition[];
}
export interface LayerTemplateMapping {
    layerProperty: string;
    sourceProperty: string;
    transform?: 'uppercase' | 'lowercase' | 'camelCase' | 'kebabCase';
    defaultValue?: any;
}
export interface LayerTemplate {
    id: string;
    name: string;
    description: string;
    triggerLayer?: string;
    sourceFile: string;
    contentParser: 'json' | 'yaml' | 'toml' | 'text';
    layerTemplate: {
        type: string;
        category: string;
        derivationType: 'content' | 'presence' | 'aggregation';
    };
    llmPrompt?: string;
    outputMapping: LayerTemplateMapping[];
}
export interface LayerTemplateConfig {
    version: string;
    description?: string;
    templates: LayerTemplate[];
}
export interface ConfigSource {
    type: 'github' | 'local' | 'url' | 'inline';
    owner?: string;
    repo?: string;
    branch?: string;
    path?: string;
    localPath?: string;
    url?: string;
    data?: any;
}
export declare const OFFICIAL_CONFIG_SOURCE: ConfigSource;
export declare const CONFIG_FILES: {
    readonly scanFilters: "scan-filters.json";
    readonly defaultLayers: "default-layers.json";
    readonly layerTemplates: "layer-templates.json";
};
export type ConfigType = keyof typeof CONFIG_FILES;
//# sourceMappingURL=index.d.ts.map