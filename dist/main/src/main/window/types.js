/**
 * Window types and shared data structures
 * Extracted to prevent circular dependencies
 */
/**
 * Shared window tracking maps - extracted to break circular dependencies
 * These are imported by modernWindowManager.ts and other modules
 */
export const applicationWindows = new Map();
export const specialWindows = new Map();
/**
 * Default features for different window types
 */
export const WINDOW_FEATURES = {
    main: {
        fileSystemAdapter: true,
        windowManagerAdapter: true,
        mcpToolsAdapter: true,
        githubAdapter: true,
        terminalManager: true,
        menu: true,
        devTools: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        maximizeOnShow: true,
        errorHandlers: true,
    },
    secondary: {
        fileSystemAdapter: true,
        mcpToolsAdapter: true,
        contentSecurityPolicy: true,
        externalLinkHandler: true,
        devTools: true,
        errorHandlers: true,
    },
    minimal: {
        contentSecurityPolicy: true,
        devTools: true,
        errorHandlers: true,
    },
};
