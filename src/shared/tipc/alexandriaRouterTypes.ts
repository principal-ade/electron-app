/**
 * Shared types for Alexandria TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 *
 * Note: Method names are prefixed with 'alexandria_' to avoid collisions
 * with other routers (e.g., githubRouter also has getRepository).
 */

import type { ActionContext } from '@egoist/tipc/main';
import type {
  AlexandriaEntry,
  CodebaseView,
} from '@principal-ai/alexandria-core-library';

// =============================================================================
// Re-export domain types
// =============================================================================

export type { AlexandriaEntry, CodebaseView };

export type {
  AlexandriaChangeEvent,
  AlexandriaEventType,
} from '../main-process-api-interfaces/AlexandriaAPI';

// =============================================================================
// Input Types
// =============================================================================

export interface GetRepositoryByPathInput {
  path: string;
}

export interface RegisterRepositoryInput {
  path: string;
  remoteUrl?: string;
}

export interface RemoveRepositoryInput {
  path: string;
  deleteLocal?: boolean;
}

export interface SearchRepositoriesInput {
  query: string;
}

export interface RefreshRepositoryInput {
  path: string;
}

export interface UpdateLastOpenedInput {
  path: string;
}

export interface GetCodebaseViewsInput {
  repositoryPath: string;
}

export interface GetCodebaseViewInput {
  repositoryPath: string;
  viewId: string;
}

// =============================================================================
// Router Type Definition
// =============================================================================

/**
 * Alexandria Router Type - TIPC RouterType-compatible type
 * Method names are prefixed with 'alexandria_' to avoid collisions
 */
export type AlexandriaRouterType = Record<
  string,
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  alexandria_getRepositories: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<AlexandriaEntry[]>;
  };

  alexandria_getRepositoryByPath: {
    action: (args: {
      context: ActionContext;
      input: GetRepositoryByPathInput;
    }) => Promise<AlexandriaEntry | null>;
  };

  alexandria_registerRepository: {
    action: (args: {
      context: ActionContext;
      input: RegisterRepositoryInput;
    }) => Promise<AlexandriaEntry>;
  };

  alexandria_removeRepository: {
    action: (args: {
      context: ActionContext;
      input: RemoveRepositoryInput;
    }) => Promise<boolean>;
  };

  alexandria_clearAllData: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<{
      repositoriesRemoved: number;
      workspacesRemoved: number;
    }>;
  };

  alexandria_searchRepositories: {
    action: (args: {
      context: ActionContext;
      input: SearchRepositoriesInput;
    }) => Promise<AlexandriaEntry[]>;
  };

  alexandria_getRepositoriesWithViews: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<AlexandriaEntry[]>;
  };

  alexandria_refreshRepository: {
    action: (args: {
      context: ActionContext;
      input: RefreshRepositoryInput;
    }) => Promise<AlexandriaEntry | null>;
  };

  alexandria_updateLastOpened: {
    action: (args: {
      context: ActionContext;
      input: UpdateLastOpenedInput;
    }) => Promise<void>;
  };

  alexandria_getRepositoryCount: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<number>;
  };

  alexandria_getCodebaseViews: {
    action: (args: {
      context: ActionContext;
      input: GetCodebaseViewsInput;
    }) => Promise<CodebaseView[]>;
  };

  alexandria_getCodebaseView: {
    action: (args: {
      context: ActionContext;
      input: GetCodebaseViewInput;
    }) => Promise<CodebaseView | null>;
  };
};
