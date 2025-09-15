/**
 * Window type definitions and configuration for the Electron app
 * This provides a flexible system for creating different types of windows
 * with appropriate features enabled/disabled based on their purpose
 */
/**
 * Window type enumeration
 */
export var WindowType;
(function (WindowType) {
    // Full application windows - need all features
    WindowType["MAIN_APP"] = "main-app";
    WindowType["REPOSITORY_MAPS"] = "repository-maps";
    // Content viewers - need basic features + some adapters
    WindowType["MARKDOWN_VIEWER"] = "markdown-viewer";
    WindowType["SESSION_DETAILS"] = "session-details";
    WindowType["MULTI_FILE_EDITOR"] = "multi-file-editor";
    // Tool windows - minimal features
    WindowType["TERMINAL"] = "terminal";
    // Utility windows - bare minimum
    WindowType["STORE_VIEWER"] = "store-viewer";
})(WindowType || (WindowType = {}));
/**
 * Predefined configurations for each window type
 */
export const WINDOW_TYPE_CONFIGS = {
    // Full application windows
    [WindowType.MAIN_APP]: {
        menu: true,
        devTools: true,
        fileSystemAdapter: true,
        windowManagerAdapter: true,
        mcpToolsAdapter: true,
        githubAdapter: true,
        terminalManager: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        maximizeOnShow: true,
        persistState: true,
        errorHandlers: true,
    },
    [WindowType.REPOSITORY_MAPS]: {
        menu: true,
        devTools: true,
        fileSystemAdapter: true,
        windowManagerAdapter: true,
        mcpToolsAdapter: true,
        githubAdapter: true,
        terminalManager: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        singleton: true,
        persistState: true,
        errorHandlers: true,
    },
    // Content viewers
    [WindowType.MARKDOWN_VIEWER]: {
        menu: false,
        devTools: true,
        fileSystemAdapter: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        singleton: true,
        persistState: true,
    },
    [WindowType.SESSION_DETAILS]: {
        menu: false,
        devTools: true,
        fileSystemAdapter: true,
        mcpToolsAdapter: true,
        contentSecurityPolicy: true,
        singleton: true,
        persistState: true,
    },
    [WindowType.MULTI_FILE_EDITOR]: {
        menu: true,
        devTools: true,
        fileSystemAdapter: true,
        githubAdapter: true, // Needed for viewing remote GitHub files
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        singleton: true,
        persistState: true,
        errorHandlers: true,
    },
    // Tool windows
    [WindowType.TERMINAL]: {
        menu: false,
        devTools: true,
        contentSecurityPolicy: true,
        singleton: false, // Multiple terminals allowed
        persistState: false,
    },
    // Utility windows
    [WindowType.STORE_VIEWER]: {
        menu: false,
        devTools: true,
        fileSystemAdapter: true, // Needs to access storage files
        contentSecurityPolicy: true,
        singleton: true,
        persistState: false,
    },
};
/**
 * Get the feature configuration for a window type
 */
export function getWindowFeatures(type) {
    return WINDOW_TYPE_CONFIGS[type] || {};
}
/**
 * Check if a specific feature is enabled for a window type
 */
export function isFeatureEnabled(type, feature) {
    const config = getWindowFeatures(type);
    return config[feature] === true;
}
/**
 * Merge window type features with custom overrides
 */
export function mergeWindowFeatures(type, customFeatures) {
    const baseFeatures = type ? getWindowFeatures(type) : {};
    return {
        ...baseFeatures,
        ...customFeatures,
    };
}
