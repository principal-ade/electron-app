/**
 * Window types and shared data structures
 * Extracted to prevent circular dependencies
 */
import { BrowserWindow } from 'electron';
/**
 * Window features configuration
 */
export interface WindowFeatures {
    fileSystemAdapter?: boolean;
    windowManagerAdapter?: boolean;
    mcpToolsAdapter?: boolean;
    githubAdapter?: boolean;
    terminalManager?: boolean;
    menu?: boolean;
    devTools?: boolean;
    contentSecurityPolicy?: boolean;
    externalLinkHandler?: boolean;
    maximizeOnShow?: boolean;
    errorHandlers?: boolean;
}
/**
 * Forward declaration of ModernApplicationWindow for typing
 * The actual class remains in modernWindowManager.ts
 */
export interface IModernApplicationWindow {
    window: BrowserWindow;
    features: WindowFeatures;
    fileSystemAdapter?: any;
    windowManagerAdapter?: any;
    mcpToolsAdapter?: any;
    githubAdapter?: any;
}
/**
 * Shared window tracking maps - extracted to break circular dependencies
 * These are imported by modernWindowManager.ts and other modules
 */
export declare const applicationWindows: Map<number, IModernApplicationWindow>;
export declare const specialWindows: Map<string, number>;
/**
 * Default features for different window types
 */
export declare const WINDOW_FEATURES: Record<string, WindowFeatures>;
//# sourceMappingURL=types.d.ts.map