/**
 * Configuration type definitions for layer system
 * These types define the structure of configs fetched from Voyager-Guides
 */
// Official Specktor configurations source
export const OFFICIAL_CONFIG_SOURCE = {
    type: 'github',
    owner: 'a24z-ai',
    repo: 'specktor-configurations',
    branch: 'main',
};
// Configuration file names
export const CONFIG_FILES = {
    scanFilters: 'scan-filters.json',
    defaultLayers: 'default-layers.json',
    layerTemplates: 'layer-templates.json',
};
