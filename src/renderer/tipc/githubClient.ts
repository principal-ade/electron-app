/**
 * TIPC Client for GitHub Operations
 *
 * Type-safe RPC for GitHub API interactions, replacing the legacy
 * ipcRenderer.invoke pattern via GithubService.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  GetUserRepositoriesInput,
  GetUserStarredRepositoriesInput,
  GetOrgRepositoriesInput,
  GetTreeInput,
  GetFileContentInput,
  GetRepositoryInput,
  CreateRepositoryInput2,
  ForkRepositoryInput,
  GetUserInput,
  GetUserOrgsForUserInput,
  GetUserStarredForUserInput,
  GetOrgMembersInput,
  GetUserFollowersInput,
  GetUserFollowingInput,
  GithubRouterType,
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubOrgMember,
  GitHubLicenseTemplate,
  GitHubRepositoryWithPermissions,
  GitHubRepositoryCreated,
  TokenInfo,
  SSHKeysResponse,
  TreeResponse,
  FileContentResponse,
} from '../../shared/tipc/githubRouterTypes';

// =============================================================================
// Client Interface
// =============================================================================

/**
 * GitHub TIPC Client interface matching the router implementation.
 * This provides typed access to all GitHub operations.
 */
export interface GithubClient {
  // User & Auth
  getCurrentUser: () => Promise<GitHubUser | null>;
  getTokenInfo: () => Promise<TokenInfo | null>;
  getUserSSHKeys: () => Promise<SSHKeysResponse>;

  // User Repositories
  getUserRepositories: (
    input: GetUserRepositoriesInput,
  ) => Promise<GitHubRepository[]>;
  getUserStarredRepositories: (
    input: GetUserStarredRepositoriesInput,
  ) => Promise<GitHubRepository[]>;

  // Organizations
  getUserOrganizations: () => Promise<GitHubOrganization[]>;
  getOrgRepositories: (
    input: GetOrgRepositoriesInput,
  ) => Promise<GitHubRepository[]>;
  getOrgMembers: (input: GetOrgMembersInput) => Promise<GitHubOrgMember[]>;

  // User Profile (for other users)
  getUser: (input: GetUserInput) => Promise<GitHubUser | null>;
  getUserOrganizationsForUser: (
    input: GetUserOrgsForUserInput,
  ) => Promise<GitHubOrganization[]>;
  getUserStarredRepositoriesForUser: (
    input: GetUserStarredForUserInput,
  ) => Promise<GitHubRepository[]>;
  getUserFollowers: (input: GetUserFollowersInput) => Promise<GitHubUser[]>;
  getUserFollowing: (input: GetUserFollowingInput) => Promise<GitHubUser[]>;

  // Repository Operations
  getRepository: (
    input: GetRepositoryInput,
  ) => Promise<GitHubRepositoryWithPermissions | null>;
  createRepository: (
    input: CreateRepositoryInput2,
  ) => Promise<GitHubRepositoryCreated>;
  forkRepository: (
    input: ForkRepositoryInput,
  ) => Promise<GitHubRepositoryCreated | null>;
  getTree: (input: GetTreeInput) => Promise<TreeResponse>;
  getFileContent: (input: GetFileContentInput) => Promise<FileContentResponse>;

  // Templates
  getGitignoreTemplates: () => Promise<string[]>;
  getLicenseTemplates: () => Promise<GitHubLicenseTemplate[]>;
}

// =============================================================================
// Lazy-initialized Client
// =============================================================================

/**
 * Lazy-initialized TIPC client for GitHub operations.
 * We use lazy initialization because window.electron is injected by the preload
 * script and isn't available at module load time.
 */
let _githubClient: GithubClient | null = null;

function getGithubClient(): GithubClient {
  if (!_githubClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'GitHub client not available - window.electron not initialized',
      );
    }
    // Use shared GithubRouterType which satisfies RouterType constraint
    _githubClient = createClient<GithubRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as GithubClient;
  }
  return _githubClient;
}

// =============================================================================
// Exported Proxy Client
// =============================================================================

/**
 * GitHub TIPC client instance.
 * This is a Proxy that lazily accesses the actual client on first use.
 */
export const githubClient: GithubClient = new Proxy({} as GithubClient, {
  get(_target, prop: keyof GithubClient) {
    const client = getGithubClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  GetUserRepositoriesInput,
  GetUserStarredRepositoriesInput,
  GetOrgRepositoriesInput,
  GetTreeInput,
  GetFileContentInput,
  GetRepositoryInput,
  CreateRepositoryInput2,
  ForkRepositoryInput,
  GetUserInput,
  GetUserOrgsForUserInput,
  GetUserStarredForUserInput,
  GetOrgMembersInput,
  GetUserFollowersInput,
  GetUserFollowingInput,
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubOrgMember,
  GitHubLicenseTemplate,
  GitHubRepositoryWithPermissions,
  GitHubRepositoryCreated,
  TokenInfo,
  SSHKeysResponse,
  TreeResponse,
  FileContentResponse,
};
