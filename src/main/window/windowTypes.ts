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
  // Core features
  menu?: boolean; // Include application menu
  devTools?: boolean; // Enable dev tools

  // Adapters (heavy features that add IPC handlers)
  fileSystemAdapter?: boolean; // File system operations
  windowManagerAdapter?: boolean; // Window management capabilities
  githubAdapter?: boolean; // GitHub integration
  terminalManager?: boolean; // Terminal management

  // Security features
  contentSecurityPolicy?: boolean; // Apply CSP headers
  externalLinkHandler?: boolean; // Handle external link opens

  // UI behaviors
  maximizeOnShow?: boolean; // Maximize window when shown
  singleton?: boolean; // Only allow one instance
  persistState?: boolean; // Remember size/position

  // Diagnostics
  errorHandlers?: boolean; // Attach error event handlers
}

/**
 * Window type enumeration
 */
export enum WindowType {
  // Full application windows - need all features
  MAIN_APP = 'main-app',
  REPOSITORY_MAPS = 'repository-maps',

  // Content viewers - need basic features + some adapters
  MARKDOWN_VIEWER = 'markdown-viewer',
  SESSION_DETAILS = 'session-details',
  MULTI_FILE_EDITOR = 'multi-file-editor',

  // Tool windows - minimal features
  TERMINAL = 'terminal',

  // Utility windows - bare minimum
  STORE_VIEWER = 'store-viewer',
}

/**
 * Predefined configurations for each window type
 */
export const WINDOW_TYPE_CONFIGS: Record<WindowType, WindowFeatures> = {
  // Full application windows
  [WindowType.MAIN_APP]: {
    menu: true,
    devTools: true,
    fileSystemAdapter: true,
    windowManagerAdapter: true,
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
export function getWindowFeatures(type: WindowType): WindowFeatures {
  return WINDOW_TYPE_CONFIGS[type] || {};
}

/**
 * Check if a specific feature is enabled for a window type
 */
export function isFeatureEnabled(
  type: WindowType,
  feature: keyof WindowFeatures,
): boolean {
  const config = getWindowFeatures(type);
  return config[feature] === true;
}

/**
 * Window creation options with type and custom features
 */
export interface TypedWindowOptions extends BrowserWindowConstructorOptions {
  windowType?: WindowType;
  features?: Partial<WindowFeatures>; // Override default features
}

/**
 * Merge window type features with custom overrides
 */
export function mergeWindowFeatures(
  type?: WindowType,
  customFeatures?: Partial<WindowFeatures>,
): WindowFeatures {
  const baseFeatures = type ? getWindowFeatures(type) : {};
  return {
    ...baseFeatures,
    ...customFeatures,
  };
}
