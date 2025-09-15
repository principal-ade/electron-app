/**
 * Window type definitions and configuration for the Electron app
 * This provides a flexible system for creating different types of windows
 * with appropriate features enabled/disabled based on their purpose
 */
import { BrowserWindowConstructorOptions } from 'electron';
/**
 * Features that can be enabled/disabled for different window types
 */
export interface WindowFeatures {
    menu?: boolean;
    devTools?: boolean;
    fileSystemAdapter?: boolean;
    windowManagerAdapter?: boolean;
    mcpToolsAdapter?: boolean;
    githubAdapter?: boolean;
    terminalManager?: boolean;
    contentSecurityPolicy?: boolean;
    externalLinkHandler?: boolean;
    maximizeOnShow?: boolean;
    singleton?: boolean;
    persistState?: boolean;
    errorHandlers?: boolean;
}
/**
 * Window type enumeration
 */
export declare enum WindowType {
    MAIN_APP = "main-app",
    REPOSITORY_MAPS = "repository-maps",
    MARKDOWN_VIEWER = "markdown-viewer",
    SESSION_DETAILS = "session-details",
    MULTI_FILE_EDITOR = "multi-file-editor",
    TERMINAL = "terminal",
    STORE_VIEWER = "store-viewer"
}
/**
 * Predefined configurations for each window type
 */
export declare const WINDOW_TYPE_CONFIGS: Record<WindowType, WindowFeatures>;
/**
 * Get the feature configuration for a window type
 */
export declare function getWindowFeatures(type: WindowType): WindowFeatures;
/**
 * Check if a specific feature is enabled for a window type
 */
export declare function isFeatureEnabled(type: WindowType, feature: keyof WindowFeatures): boolean;
/**
 * Window creation options with type and custom features
 */
export interface TypedWindowOptions extends BrowserWindowConstructorOptions {
    windowType?: WindowType;
    features?: Partial<WindowFeatures>;
}
/**
 * Merge window type features with custom overrides
 */
export declare function mergeWindowFeatures(type?: WindowType, customFeatures?: Partial<WindowFeatures>): WindowFeatures;
//# sourceMappingURL=windowTypes.d.ts.map