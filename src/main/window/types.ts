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
  fileSystemAdapter?: any; // Import types would create circular deps
  windowManagerAdapter?: any;
  githubAdapter?: any;
}

/**
 * Shared window tracking maps - extracted to break circular dependencies
 * These are imported by modernWindowManager.ts and other modules
 */
export const applicationWindows = new Map<number, IModernApplicationWindow>();
export const specialWindows = new Map<string, number>();

/**
 * Reference to the main window (first window created)
 */
export let mainWindowId: number | null = null;

export function setMainWindowId(id: number) {
  mainWindowId = id;
}

export function getMainWindowId(): number | null {
  return mainWindowId;
}

/**
 * Default features for different window types
 */
export const WINDOW_FEATURES: Record<string, WindowFeatures> = {
  main: {
    fileSystemAdapter: true,
    windowManagerAdapter: true,
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
