/**
 * TIPC Router for GitHub Operations
 *
 * Type-safe RPC for GitHub API interactions.
 * Replaces the legacy ipcMain.handle pattern.
 */

import { tipc } from '@egoist/tipc/main';
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
  GetRepositoryCollaboratorsInput,
  GetUserFollowersInput,
  GetUserFollowingInput,
  FollowUserInput,
  UnfollowUserInput,
  IsFollowingUserInput,
  SearchUsersInput,
  SearchReposInput,
  RepoStarInput,
  GetOwnerActivityInput,
  GetRepoActivityInput,
} from '../../../shared/tipc/githubRouterTypes';

// Import the existing GitHubAdapter - we'll reuse its methods
import { GitHubAdapter } from '../../version-control-providers/githubHandlers';

// Create a shared adapter instance
const githubAdapter = new GitHubAdapter();

const t = tipc.create();

export const githubRouter = {
  // ===========================================================================
  // User & Auth
  // ===========================================================================

  getCurrentUser: t.procedure.action(async () => {
    return githubAdapter.getCurrentUser();
  }),

  getTokenInfo: t.procedure.action(async () => {
    return githubAdapter.getTokenInfo();
  }),

  getUserSSHKeys: t.procedure.action(async () => {
    return githubAdapter.getUserSSHKeys();
  }),

  // ===========================================================================
  // User Repositories
  // ===========================================================================

  getUserRepositories: t.procedure
    .input<GetUserRepositoriesInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserRepositories(input.options);
    }),

  getUserStarredRepositories: t.procedure
    .input<GetUserStarredRepositoriesInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserStarredRepositories(input.options);
    }),

  // ===========================================================================
  // Organizations
  // ===========================================================================

  getUserOrganizations: t.procedure.action(async () => {
    return githubAdapter.getUserOrganizations();
  }),

  getOrgRepositories: t.procedure
    .input<GetOrgRepositoriesInput>()
    .action(async ({ input }) => {
      return githubAdapter.getOrgRepositories(input.org, input.options);
    }),

  getOrgMembers: t.procedure
    .input<GetOrgMembersInput>()
    .action(async ({ input }) => {
      return githubAdapter.getOrgMembers(input.org);
    }),

  getRepositoryCollaborators: t.procedure
    .input<GetRepositoryCollaboratorsInput>()
    .action(async ({ input }) => {
      return githubAdapter.getRepositoryCollaborators(input.owner, input.repo);
    }),

  // ===========================================================================
  // User Profile (for other users)
  // ===========================================================================

  getUser: t.procedure
    .input<GetUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUser(input.username);
    }),

  searchUsers: t.procedure
    .input<SearchUsersInput>()
    .action(async ({ input }) => {
      return githubAdapter.searchUsers(input.query, { perPage: input.perPage });
    }),

  searchRepos: t.procedure
    .input<SearchReposInput>()
    .action(async ({ input }) => {
      return githubAdapter.searchRepos(input.query, { perPage: input.perPage });
    }),

  getUserOrganizationsForUser: t.procedure
    .input<GetUserOrgsForUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserOrganizationsForUser(input.username);
    }),

  getUserStarredRepositoriesForUser: t.procedure
    .input<GetUserStarredForUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserStarredRepositoriesForUser(
        input.username,
        input.options,
      );
    }),

  getUserFollowers: t.procedure
    .input<GetUserFollowersInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserFollowers(input.username);
    }),

  getUserFollowing: t.procedure
    .input<GetUserFollowingInput>()
    .action(async ({ input }) => {
      return githubAdapter.getUserFollowing(input.username);
    }),

  isFollowingUser: t.procedure
    .input<IsFollowingUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.isFollowingUser(input.username);
    }),

  followUser: t.procedure
    .input<FollowUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.followUser(input.username);
    }),

  unfollowUser: t.procedure
    .input<UnfollowUserInput>()
    .action(async ({ input }) => {
      return githubAdapter.unfollowUser(input.username);
    }),

  getOwnerActivity: t.procedure
    .input<GetOwnerActivityInput>()
    .action(async ({ input }) => {
      return githubAdapter.getOwnerActivity(input.login, input.type, input.days);
    }),

  getRepoActivity: t.procedure
    .input<GetRepoActivityInput>()
    .action(async ({ input }) => {
      return githubAdapter.getRepoActivity(input.owner, input.repo, input.days);
    }),

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  getRepository: t.procedure
    .input<GetRepositoryInput>()
    .action(async ({ input }) => {
      return githubAdapter.getRepository(input.owner, input.repo);
    }),

  createRepository: t.procedure
    .input<CreateRepositoryInput2>()
    .action(async ({ input }) => {
      return githubAdapter.createRepository(
        input.owner,
        input.input,
        input.isOrganization,
      );
    }),

  forkRepository: t.procedure
    .input<ForkRepositoryInput>()
    .action(async ({ input }) => {
      return githubAdapter.forkRepository(input.owner, input.repo, input.options);
    }),

  getTree: t.procedure
    .input<GetTreeInput>()
    .action(async ({ input }) => {
      return githubAdapter.getTree(input.owner, input.repo, input.branch);
    }),

  getFileContent: t.procedure
    .input<GetFileContentInput>()
    .action(async ({ input }) => {
      return githubAdapter.getFileContent(
        input.owner,
        input.repo,
        input.path,
        input.branch,
      );
    }),

  // ===========================================================================
  // Templates
  // ===========================================================================

  getGitignoreTemplates: t.procedure.action(async () => {
    return githubAdapter.getGitignoreTemplates();
  }),

  getLicenseTemplates: t.procedure.action(async () => {
    return githubAdapter.getLicenseTemplates();
  }),

  // ===========================================================================
  // Skills
  // TODO: installSkill needs to be extracted from the inline ipcMain.handle
  // implementation in githubHandlers.ts before it can be migrated here.
  // For now, it remains in the legacy handler until refactored.
  // ===========================================================================

  // ===========================================================================
  // Star / Unstar
  // ===========================================================================

  isRepositoryStarred: t.procedure
    .input<RepoStarInput>()
    .action(async ({ input }) => {
      return githubAdapter.isRepositoryStarred(input.owner, input.repo);
    }),

  starRepository: t.procedure
    .input<RepoStarInput>()
    .action(async ({ input }) => {
      return githubAdapter.starRepository(input.owner, input.repo);
    }),

  unstarRepository: t.procedure
    .input<RepoStarInput>()
    .action(async ({ input }) => {
      return githubAdapter.unstarRepository(input.owner, input.repo);
    }),
};

export type GithubRouter = typeof githubRouter;
