/**
 * Configuration constants for Specktor configuration files
 * These are used across the monorepo for fetching and loading configurations
 */
export const SPECKTOR_GITHUB_CONFIG = {
    owner: 'a24z-ai',
    repo: 'specktor-configurations',
    branch: 'main',
    files: {
        scanFilters: 'scan-filters.json',
        layerTemplates: 'layer-templates.json',
        defaultLayers: 'default-layers.json',
    },
};
/**
 * Build a raw GitHub URL for a configuration file
 */
export function getGitHubConfigUrl(filename) {
    const { owner, repo, branch } = SPECKTOR_GITHUB_CONFIG;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`;
}
/**
 * Get all configuration URLs
 */
export function getAllConfigUrls() {
    const urls = {};
    for (const [key, filename] of Object.entries(SPECKTOR_GITHUB_CONFIG.files)) {
        urls[key] = getGitHubConfigUrl(filename);
    }
    return urls;
}
/**
 * Default configuration options
 */
export const DEFAULT_CONFIG_OPTIONS = {
    preferGitHub: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    fallbackToLocal: true,
};
//# sourceMappingURL=constants.js.map