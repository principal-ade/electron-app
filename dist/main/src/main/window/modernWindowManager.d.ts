/**
 * Modern Window Manager - Bridge between old and new window systems
 * Provides clean window creation while maintaining compatibility
 */
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import { ElectronWindowManagerAdapter } from './windowManagerHandlers';
import { McpToolsAdapter } from '../principal-mcp/mcpToolsHandlers';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
export declare const applicationWindows: Map<number, ModernApplicationWindow>;
export declare const specialWindows: Map<string, number>;
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
 * Default features for different window types
 */
declare const WINDOW_FEATURES: Record<string, WindowFeatures>;
/**
 * Modern Application Window class
 */
export declare class ModernApplicationWindow {
    window: BrowserWindow;
    features: WindowFeatures;
    fileSystemAdapter?: ElectronFileSystemAdapter;
    windowManagerAdapter?: ElectronWindowManagerAdapter;
    mcpToolsAdapter?: McpToolsAdapter;
    githubAdapter?: GitHubAdapter;
    private menuBuilder?;
    constructor(options?: BrowserWindowConstructorOptions, windowType?: keyof typeof WINDOW_FEATURES, customFeatures?: Partial<WindowFeatures>);
    private getDefaultOptions;
    private initializeFeatures;
    private attachErrorHandlers;
    private setupContentSecurityPolicy;
    private setupWindowBehaviors;
    get id(): number;
    get webContents(): Electron.WebContents;
    close(): void;
}
/**
 * Create a window (compatible with old createWindow signature)
 */
export declare function createWindow(options?: BrowserWindowConstructorOptions): Promise<ModernApplicationWindow | null>;
/**
 * Create a special purpose window
 */
export declare function createSpecialWindow(purpose: string, options: BrowserWindowConstructorOptions, features?: Partial<WindowFeatures>): ModernApplicationWindow | null;
export declare const getApplicationWindows: () => Map<number, ModernApplicationWindow>;
export declare const getSpecialWindows: () => Map<string, number>;
export declare const handleAppRestart: () => void;
export declare const getIsRestarting: () => boolean;
export declare const setIsRestarting: (value: boolean) => void;
export type OldApplicationWindow = ModernApplicationWindow;
export {};
//# sourceMappingURL=modernWindowManager.d.ts.map