/**
 * TIPC Client for Alexandria Operations
 *
 * Type-safe RPC for Alexandria repository management, replacing the legacy
 * ipcRenderer.invoke pattern via AlexandriaService.
 *
 * Note: Method names are prefixed with 'alexandria_' to avoid collisions
 * with other routers (e.g., githubRouter also has getRepository).
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  AlexandriaRouterType,
  AlexandriaEntry,
  CodebaseView,
  GetRepositoryByPathInput,
  RegisterRepositoryInput,
  RemoveRepositoryInput,
  SearchRepositoriesInput,
  RefreshRepositoryInput,
  UpdateLastOpenedInput,
  GetCodebaseViewsInput,
  GetCodebaseViewInput,
} from '../../shared/tipc/alexandriaRouterTypes';

// =============================================================================
// Client Interface
// =============================================================================

/**
 * Alexandria TIPC Client interface matching the router implementation.
 * This provides typed access to all Alexandria operations.
 * Uses prefixed method names internally but exposes clean API.
 */
export interface AlexandriaClient {
  // Repository Queries
  getRepositories: () => Promise<AlexandriaEntry[]>;
  getRepositoryByPath: (
    input: GetRepositoryByPathInput,
  ) => Promise<AlexandriaEntry | null>;
  searchRepositories: (
    input: SearchRepositoriesInput,
  ) => Promise<AlexandriaEntry[]>;
  getRepositoriesWithViews: () => Promise<AlexandriaEntry[]>;
  getRepositoryCount: () => Promise<number>;

  // Repository Mutations
  registerRepository: (
    input: RegisterRepositoryInput,
  ) => Promise<AlexandriaEntry>;
  removeRepository: (input: RemoveRepositoryInput) => Promise<boolean>;
  refreshRepository: (
    input: RefreshRepositoryInput,
  ) => Promise<AlexandriaEntry | null>;
  updateLastOpened: (input: UpdateLastOpenedInput) => Promise<void>;
  clearAllData: () => Promise<{
    repositoriesRemoved: number;
    workspacesRemoved: number;
  }>;

  // Codebase Views
  getCodebaseViews: (input: GetCodebaseViewsInput) => Promise<CodebaseView[]>;
  getCodebaseView: (
    input: GetCodebaseViewInput,
  ) => Promise<CodebaseView | null>;
}

// =============================================================================
// Internal TIPC Client Type (with prefixed names)
// =============================================================================

interface TipcAlexandriaClient {
  alexandria_getRepositories: () => Promise<AlexandriaEntry[]>;
  alexandria_getRepositoryByPath: (
    input: GetRepositoryByPathInput,
  ) => Promise<AlexandriaEntry | null>;
  alexandria_searchRepositories: (
    input: SearchRepositoriesInput,
  ) => Promise<AlexandriaEntry[]>;
  alexandria_getRepositoriesWithViews: () => Promise<AlexandriaEntry[]>;
  alexandria_getRepositoryCount: () => Promise<number>;
  alexandria_registerRepository: (
    input: RegisterRepositoryInput,
  ) => Promise<AlexandriaEntry>;
  alexandria_removeRepository: (
    input: RemoveRepositoryInput,
  ) => Promise<boolean>;
  alexandria_refreshRepository: (
    input: RefreshRepositoryInput,
  ) => Promise<AlexandriaEntry | null>;
  alexandria_updateLastOpened: (input: UpdateLastOpenedInput) => Promise<void>;
  alexandria_clearAllData: () => Promise<{
    repositoriesRemoved: number;
    workspacesRemoved: number;
  }>;
  alexandria_getCodebaseViews: (
    input: GetCodebaseViewsInput,
  ) => Promise<CodebaseView[]>;
  alexandria_getCodebaseView: (
    input: GetCodebaseViewInput,
  ) => Promise<CodebaseView | null>;
}

// =============================================================================
// Lazy-initialized Client
// =============================================================================

let _tipcClient: TipcAlexandriaClient | null = null;

function getTipcClient(): TipcAlexandriaClient {
  if (!_tipcClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'Alexandria client not available - window.electron not initialized',
      );
    }
    _tipcClient = createClient<AlexandriaRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as TipcAlexandriaClient;
  }
  return _tipcClient;
}

// =============================================================================
// Exported Client (maps clean names to prefixed TIPC names)
// =============================================================================

/**
 * Alexandria TIPC client instance.
 * Wraps the prefixed TIPC methods with clean, unprefixed names.
 */
export const alexandriaClient: AlexandriaClient = {
  getRepositories: () => getTipcClient().alexandria_getRepositories(),
  getRepositoryByPath: (input) =>
    getTipcClient().alexandria_getRepositoryByPath(input),
  searchRepositories: (input) =>
    getTipcClient().alexandria_searchRepositories(input),
  getRepositoriesWithViews: () =>
    getTipcClient().alexandria_getRepositoriesWithViews(),
  getRepositoryCount: () => getTipcClient().alexandria_getRepositoryCount(),
  registerRepository: (input) =>
    getTipcClient().alexandria_registerRepository(input),
  removeRepository: (input) =>
    getTipcClient().alexandria_removeRepository(input),
  refreshRepository: (input) =>
    getTipcClient().alexandria_refreshRepository(input),
  updateLastOpened: (input) =>
    getTipcClient().alexandria_updateLastOpened(input),
  clearAllData: () => getTipcClient().alexandria_clearAllData(),
  getCodebaseViews: (input) =>
    getTipcClient().alexandria_getCodebaseViews(input),
  getCodebaseView: (input) => getTipcClient().alexandria_getCodebaseView(input),
};

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  AlexandriaEntry,
  CodebaseView,
  GetRepositoryByPathInput,
  RegisterRepositoryInput,
  RemoveRepositoryInput,
  SearchRepositoriesInput,
  RefreshRepositoryInput,
  UpdateLastOpenedInput,
  GetCodebaseViewsInput,
  GetCodebaseViewInput,
};
