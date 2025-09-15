import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
/**
 * Default window configuration to prevent white flash and ensure consistent behavior
 * Apply these defaults to any BrowserWindow creation to maintain visual consistency
 */
export declare const getWindowDefaults: () => Partial<BrowserWindowConstructorOptions>;
/**
 * Merge user options with defaults, allowing overrides
 */
export declare const mergeWindowOptions: (userOptions?: BrowserWindowConstructorOptions) => BrowserWindowConstructorOptions;
/**
 * Setup standard window show behavior to prevent white flash
 * Call this after creating a window and loading its URL
 *
 * @param window - The BrowserWindow instance to setup
 * @param delay - Optional delay in milliseconds before showing (default: 100ms)
 */
export declare const setupWindowShowBehavior: (window: BrowserWindow, delay?: number) => void;
/**
 * Apply defaults and show behavior to an existing window
 * Useful for retrofitting existing window creation code
 *
 * Note: backgroundColor must be set during window creation,
 * this function only helps with show behavior for existing windows
 */
export declare const applyWindowDefaults: (window: BrowserWindow, delay?: number) => void;
//# sourceMappingURL=windowDefaults.d.ts.map