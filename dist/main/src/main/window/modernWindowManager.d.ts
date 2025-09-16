/**
 * Modern Window Manager - Bridge between old and new window systems
 * Provides clean window creation while maintaining compatibility
 */
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import { ElectronWindowManagerAdapter } from './windowManagerHandlers';
import { McpToolsAdapter } from '../principal-mcp/mcpToolsHandlers';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
import { WindowFeatures, IModernApplicationWindow, WINDOW_FEATURES } from './types';
export { applicationWindows, specialWindows, WindowFeatures } from './types';
/**
 * Modern Application Window class
 */
export declare class ModernApplicationWindow implements IModernApplicationWindow {
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
    private setupTitlebarHandlers;
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
export declare const getApplicationWindows: () => Map<number, IModernApplicationWindow>;
export declare const getSpecialWindows: () => Map<string, number>;
export declare const handleAppRestart: () => void;
export declare const getIsRestarting: () => boolean;
export declare const setIsRestarting: (value: boolean) => void;
export type OldApplicationWindow = ModernApplicationWindow;
//# sourceMappingURL=modernWindowManager.d.ts.map