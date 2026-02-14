/**
 * Window types and shared data structures
 * Extracted to prevent circular dependencies
 */

import { BrowserWindow } from 'electron';
import type { ElectronFileSystemAdapter } from '../file-system/fileSystemHandlers';
import type { ElectronWindowManagerAdapter } from './windowManagerHandlers';
import type { GitHubAdapter } from '../version-control-providers/githubHandlers';

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
 * Primary window type classification for the main window categories
 */
export enum PrimaryWindowType {
  MAIN = 'main',
  REPOSITORY = 'repository',
  WORKSPACE = 'workspace',
  DEV_WORKSPACE = 'dev-workspace',
  EXTENSION = 'extension',
  UNKNOWN = 'unknown',
}

/**
 * Window metadata for type-safe window identification
 */
export interface WindowMetadata {
  primaryType: PrimaryWindowType;
  displayName: string;
  // For repositories
  remoteUrl?: string;
  localPath?: string;
  // For workspaces
  workspaceId?: string;
  // Original purpose string for backward compatibility
  purpose?: string;
}

/**
 * Forward declaration of ModernApplicationWindow for typing
 * The actual class remains in modernWindowManager.ts
 *
 * Note: Uses type-only imports to avoid circular dependencies.
 * Since both sides use 'import type', no runtime dependency exists.
 */
export interface IModernApplicationWindow {
  window: BrowserWindow;
  features: WindowFeatures;
  metadata: WindowMetadata;
  fileSystemAdapter?: ElectronFileSystemAdapter;
  windowManagerAdapter?: ElectronWindowManagerAdapter;
  githubAdapter?: GitHubAdapter;
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

export function setMainWindowId(id: number | null) {
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

/**
 * Helper functions for type-safe window identification
 */

export function getWindowMetadata(windowId: number): WindowMetadata | null {
  const appWindow = applicationWindows.get(windowId);
  return appWindow?.metadata ?? null;
}

export function isMainWindow(windowId: number): boolean {
  return windowId === mainWindowId;
}

export function isRepositoryWindow(windowId: number): boolean {
  return (
    getWindowMetadata(windowId)?.primaryType === PrimaryWindowType.REPOSITORY
  );
}

export function isWorkspaceWindow(windowId: number): boolean {
  return (
    getWindowMetadata(windowId)?.primaryType === PrimaryWindowType.WORKSPACE
  );
}

export function getRepositoryUrl(windowId: number): string | null {
  const metadata = getWindowMetadata(windowId);
  return metadata?.primaryType === PrimaryWindowType.REPOSITORY
    ? (metadata.remoteUrl ?? null)
    : null;
}

export function getWorkspaceId(windowId: number): string | null {
  const metadata = getWindowMetadata(windowId);
  return metadata?.primaryType === PrimaryWindowType.WORKSPACE
    ? (metadata.workspaceId ?? null)
    : null;
}

/**
 * Get all windows of a specific type
 */
export function getWindowsByType(type: PrimaryWindowType): number[] {
  const windowIds: number[] = [];
  for (const [id, appWindow] of applicationWindows.entries()) {
    if (appWindow.metadata?.primaryType === type) {
      windowIds.push(id);
    }
  }
  return windowIds;
}
