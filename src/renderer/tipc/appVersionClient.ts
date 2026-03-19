/**
 * TIPC Client for App Version Operations
 *
 * Type-safe RPC for app version and update operations, replacing the legacy
 * ipcRenderer.invoke/send pattern via AppVersionManagerService.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  CheckForUpdateInput,
  CheckForUpdateResult,
  DownloadUpdateResult,
  InstallUpdateResult,
  TestGoodbyeScreenResult,
  VersionInfo,
  AppVersionRouterType,
} from '../../shared/tipc/appVersionRouterTypes';

// =============================================================================
// Client Interface
// =============================================================================

/**
 * AppVersion TIPC Client interface matching the router implementation.
 * This provides typed access to all app version operations.
 */
export interface AppVersionClient {
  // Version Info
  getVersion: () => Promise<string>;
  getVersionInfo: () => Promise<VersionInfo>;
  isDevMode: () => Promise<boolean>;

  // Update Operations
  checkForUpdate: (input: CheckForUpdateInput) => Promise<CheckForUpdateResult>;
  downloadUpdate: () => Promise<DownloadUpdateResult>;
  installUpdate: () => Promise<InstallUpdateResult>;
  testDownloadUpdate: () => Promise<DownloadUpdateResult>;
  testGoodbyeScreen: () => Promise<TestGoodbyeScreenResult>;
}

// =============================================================================
// Lazy-initialized Client
// =============================================================================

/**
 * Lazy-initialized TIPC client for app version operations.
 * We use lazy initialization because window.electron is injected by the preload
 * script and isn't available at module load time.
 */
let _appVersionClient: AppVersionClient | null = null;

function getAppVersionClient(): AppVersionClient {
  if (!_appVersionClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'AppVersion client not available - window.electron not initialized',
      );
    }
    // Use shared AppVersionRouterType which satisfies RouterType constraint
    _appVersionClient = createClient<AppVersionRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as AppVersionClient;
  }
  return _appVersionClient;
}

// =============================================================================
// Exported Proxy Client
// =============================================================================

/**
 * AppVersion TIPC client instance.
 * This is a Proxy that lazily accesses the actual client on first use.
 */
export const appVersionClient: AppVersionClient = new Proxy(
  {} as AppVersionClient,
  {
    get(_target, prop: keyof AppVersionClient) {
      const client = getAppVersionClient();
      const value = client[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    },
  },
);

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  CheckForUpdateInput,
  CheckForUpdateResult,
  DownloadUpdateResult,
  InstallUpdateResult,
  TestGoodbyeScreenResult,
  VersionInfo,
};
