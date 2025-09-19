import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

/**
 * Default window configuration to prevent white flash and ensure consistent behavior
 * Apply these defaults to any BrowserWindow creation to maintain visual consistency
 */
export const getWindowDefaults =
  (): Partial<BrowserWindowConstructorOptions> => {
    return {
      backgroundColor: '#1f2937', // Dark gray matching the app's theme to prevent white flash
      show: false, // Don't show until content is loaded
    };
  };

/**
 * Merge user options with defaults, allowing overrides
 */
export const mergeWindowOptions = (
  userOptions: BrowserWindowConstructorOptions = {},
): BrowserWindowConstructorOptions => {
  const defaults = getWindowDefaults();
  return {
    ...defaults,
    ...userOptions,
    // Merge webPreferences separately to preserve both defaults and user settings
    webPreferences: {
      ...defaults.webPreferences,
      ...userOptions.webPreferences,
    },
  };
};

/**
 * Setup standard window show behavior to prevent white flash
 * Call this after creating a window and loading its URL
 *
 * @param window - The BrowserWindow instance to setup
 * @param delay - Optional delay in milliseconds before showing (default: 100ms)
 */
export const setupWindowShowBehavior = (
  window: BrowserWindow,
  delay: number = 100,
): void => {
  // Use did-finish-load to ensure content and styles are loaded
  window.webContents.once('did-finish-load', () => {
    // Small delay to ensure CSS is fully applied
    setTimeout(() => {
      if (!window.isDestroyed() && !window.isVisible()) {
        window.show();
      }
    }, delay);
  });
};

/**
 * Apply defaults and show behavior to an existing window
 * Useful for retrofitting existing window creation code
 *
 * Note: backgroundColor must be set during window creation,
 * this function only helps with show behavior for existing windows
 */
export const applyWindowDefaults = (
  window: BrowserWindow,
  delay: number = 100,
): void => {
  // If window is already visible, we can't retroactively fix the white flash
  if (!window.isVisible()) {
    setupWindowShowBehavior(window, delay);
  }
};
