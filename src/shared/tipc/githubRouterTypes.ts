/**
 * Shared types for GitHub TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 */

import type { ActionContext } from '@egoist/tipc/main';
import type { RepositoryFetchOptions } from '../main-process-api-interfaces/GitHubAPI';

// =============================================================================
// Re-export domain types from shared interfaces
// =============================================================================

export type {
  RepositoryFetchOptions,
  GitHubRepository,
  GitHubOrganization,
  GitHubUser,
  GitHubOrgMember,
  GitHubLicenseTemplate,
  GitHubRepositoryWithPermissions,
  GitHubRepositoryCreated,
  CreateRepositoryInput,
  ForkRepositoryOptions,
  InstallSkillOptions,
  InstallSkillResult,
  SSHKeysResponse,
  TokenInfo,
  SearchUsersResponse,
  SearchReposResponse,
} from '../main-process-api-interfaces/GitHubAPI';

// =============================================================================
// Input Types
// =============================================================================

export interface GetUserRepositoriesInput {
  options?: RepositoryFetchOptions;
}

export interface GetUserStarredRepositoriesInput {
  options?: RepositoryFetchOptions;
}

export interface GetOrgRepositoriesInput {
  org: string;
  options?: RepositoryFetchOptions;
}

export interface GetTreeInput {
  owner: string;
  repo: string;
  branch: string;
}

export interface GetFileContentInput {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export interface GetRepositoryInput {
  owner: string;
  repo: string;
}

export interface CreateRepositoryInput2 {
  owner: string;
  input: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
  };
  isOrganization: boolean;
}

export interface ForkRepositoryInput {
  owner: string;
  repo: string;
  options?: {
    organization?: string;
    name?: string;
    default_branch_only?: boolean;
  };
}

export interface GetUserInput {
  username: string;
}

export interface GetUserOrgsForUserInput {
  username: string;
}

export interface GetUserStarredForUserInput {
  username: string;
  options?: RepositoryFetchOptions;
}

export interface GetOrgMembersInput {
  org: string;
}

export interface GetUserFollowersInput {
  username?: string;
}

export interface GetUserFollowingInput {
  username?: string;
}

export interface SearchUsersInput {
  query: string;
  perPage?: number;
}

export interface SearchReposInput {
  query: string;
  perPage?: number;
}

export interface InstallSkillInput {
  options: import('../main-process-api-interfaces/GitHubAPI').InstallSkillOptions;
}

// =============================================================================
// Output Types
// =============================================================================

export interface TreeResponse {
  success: boolean;
  data?: {
    sha: string;
    url: string;
    tree: Array<{
      path: string;
      mode: string;
      type: 'blob' | 'tree';
      sha: string;
      size?: number;
      url?: string;
    }>;
    truncated: boolean;
  };
  error?: string;
}

export interface FileContentResponse {
  success: boolean;
  content?: string;
  encoding?: string;
  error?: string;
}

// =============================================================================
// Router Type Definition
// =============================================================================

/**
 * GitHub Router Type - TIPC RouterType-compatible type
 */
export type GithubRouterType = Record<
  string,
  { action: (args: { context: ActionContext; input: unknown }) => Promise<unknown> }
> & {
  // User & Auth
  getCurrentUser: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubUser | null>;
  };
  getTokenInfo: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').TokenInfo | null>;
  };
  getUserSSHKeys: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').SSHKeysResponse>;
  };

  // User Repositories
  getUserRepositories: {
    action: (args: {
      context: ActionContext;
      input: GetUserRepositoriesInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepository[]>;
  };
  getUserStarredRepositories: {
    action: (args: {
      context: ActionContext;
      input: GetUserStarredRepositoriesInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepository[]>;
  };

  // Organizations
  getUserOrganizations: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubOrganization[]>;
  };
  getOrgRepositories: {
    action: (args: {
      context: ActionContext;
      input: GetOrgRepositoriesInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepository[]>;
  };
  getOrgMembers: {
    action: (args: {
      context: ActionContext;
      input: GetOrgMembersInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubOrgMember[]>;
  };

  // User Profile (for other users)
  getUser: {
    action: (args: {
      context: ActionContext;
      input: GetUserInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubUser | null>;
  };
  getUserOrganizationsForUser: {
    action: (args: {
      context: ActionContext;
      input: GetUserOrgsForUserInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubOrganization[]>;
  };
  getUserStarredRepositoriesForUser: {
    action: (args: {
      context: ActionContext;
      input: GetUserStarredForUserInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepository[]>;
  };
  getUserFollowers: {
    action: (args: {
      context: ActionContext;
      input: GetUserFollowersInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubUser[]>;
  };
  getUserFollowing: {
    action: (args: {
      context: ActionContext;
      input: GetUserFollowingInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubUser[]>;
  };

  // Repository Operations
  getRepository: {
    action: (args: {
      context: ActionContext;
      input: GetRepositoryInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepositoryWithPermissions | null>;
  };
  createRepository: {
    action: (args: {
      context: ActionContext;
      input: CreateRepositoryInput2;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepositoryCreated>;
  };
  forkRepository: {
    action: (args: {
      context: ActionContext;
      input: ForkRepositoryInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubRepositoryCreated | null>;
  };
  getTree: {
    action: (args: {
      context: ActionContext;
      input: GetTreeInput;
    }) => Promise<TreeResponse>;
  };
  getFileContent: {
    action: (args: {
      context: ActionContext;
      input: GetFileContentInput;
    }) => Promise<FileContentResponse>;
  };

  // Templates
  getGitignoreTemplates: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<string[]>;
  };
  getLicenseTemplates: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').GitHubLicenseTemplate[]>;
  };

  // Skills
  installSkill: {
    action: (args: {
      context: ActionContext;
      input: InstallSkillInput;
    }) => Promise<import('../main-process-api-interfaces/GitHubAPI').InstallSkillResult>;
  };
};
