/**
 * Shared types for AppVersion TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 */

import type { ActionContext } from '@egoist/tipc/main';

// =============================================================================
// Re-export domain types from shared interfaces
// =============================================================================

export type {
  UpdateInfo,
  ProgressInfo,
  UpdateDownloadedEvent,
} from '../main-process-api-interfaces/AppVersionManagerAPI';

// =============================================================================
// Input Types
// =============================================================================

export interface CheckForUpdateInput {
  trigger: 'manual' | 'silent';
}

// =============================================================================
// Output Types
// =============================================================================

export interface VersionInfo {
  version: string;
  isDevMode: boolean;
  isPackaged: boolean;
  platform: string;
  arch: string;
}

export interface CheckForUpdateResult {
  started: boolean;
}

export interface DownloadUpdateResult {
  started: boolean;
}

export interface InstallUpdateResult {
  started: boolean;
}

// =============================================================================
// Router Type Definition
// =============================================================================

/**
 * AppVersion Router Type - TIPC RouterType-compatible type
 */
export type AppVersionRouterType = Record<
  string,
  { action: (args: { context: ActionContext; input: unknown }) => Promise<unknown> }
> & {
  // Version Info
  getVersion: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<string>;
  };

  getVersionInfo: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<VersionInfo>;
  };

  isDevMode: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<boolean>;
  };

  // Update Operations
  checkForUpdate: {
    action: (args: {
      context: ActionContext;
      input: CheckForUpdateInput;
    }) => Promise<CheckForUpdateResult>;
  };

  downloadUpdate: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<DownloadUpdateResult>;
  };

  installUpdate: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<InstallUpdateResult>;
  };

  testDownloadUpdate: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<DownloadUpdateResult>;
  };
};
