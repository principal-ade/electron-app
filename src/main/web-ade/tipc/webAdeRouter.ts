/**
 * TIPC Router for Web-ADE Operations
 *
 * Type-safe RPC for Web-ADE API interactions.
 * Follows the same pattern as githubRouter.
 */

import { tipc } from '@egoist/tipc/main';
import type {
  GetCommitQueueInput,
  GetActivityHeatmapInput,
  WatchUserInput,
  UnwatchUserInput,
  WatchRepoInput,
  UnwatchRepoInput,
  GetTreeInput,
  GetRepoContributionsInput,
  GetStarredCollectionsInput,
  GetOwnerStarredCollectionsInput,
  CreateCollectionInput,
  AddRepoToCollectionInput,
  RemoveRepoFromCollectionInput,
  GetUserActivityInput,
  GetPinnedRepositoriesInput,
  ExplainCommitsInput,
  ExplainWorkingChangesInput,
} from '../../../shared/tipc/webAdeRouterTypes';
import { WebAdeService } from '../../services/WebAdeService';

// Create a shared service instance
const webAdeService = new WebAdeService();

const t = tipc.create();

export const webAdeRouter = {
  // ===========================================================================
  // Authentication
  // ===========================================================================

  isAuthenticated: t.procedure.action(async () => {
    return webAdeService.isAuthenticated();
  }),

  // ===========================================================================
  // Watched Activity Feed
  // ===========================================================================

  getCommitQueue: t.procedure
    .input<GetCommitQueueInput>()
    .action(async ({ input }) => {
      return webAdeService.getCommitQueue(input.limit);
    }),

  getWatches: t.procedure.action(async () => {
    return webAdeService.getWatches();
  }),

  getActivityHeatmap: t.procedure
    .input<GetActivityHeatmapInput>()
    .action(async ({ input }) => {
      return webAdeService.getActivityHeatmap(input);
    }),

  // ===========================================================================
  // Watch/Unwatch Operations
  // ===========================================================================

  watchUser: t.procedure
    .input<WatchUserInput>()
    .action(async ({ input }) => {
      return webAdeService.watchUser(input.login, input.type);
    }),

  unwatchUser: t.procedure
    .input<UnwatchUserInput>()
    .action(async ({ input }) => {
      return webAdeService.unwatchUser(input.login);
    }),

  watchRepo: t.procedure
    .input<WatchRepoInput>()
    .action(async ({ input }) => {
      return webAdeService.watchRepo(input.owner, input.repo);
    }),

  unwatchRepo: t.procedure
    .input<UnwatchRepoInput>()
    .action(async ({ input }) => {
      return webAdeService.unwatchRepo(input.owner, input.repo);
    }),

  // ===========================================================================
  // GitHub Tree API (via web-ade's cached endpoint)
  // ===========================================================================

  getGithubTree: t.procedure
    .input<GetTreeInput>()
    .action(async ({ input }) => {
      return webAdeService.getGithubTree(input);
    }),

  // ===========================================================================
  // GitHub Repository Contributions (via web-ade)
  // ===========================================================================

  getRepoContributions: t.procedure
    .input<GetRepoContributionsInput>()
    .action(async ({ input }) => {
      return webAdeService.getRepoContributions(input);
    }),

  // ===========================================================================
  // User Activity
  // ===========================================================================

  getUserActivity: t.procedure
    .input<GetUserActivityInput>()
    .action(async ({ input }) => {
      return webAdeService.getUserActivity(input);
    }),

  // ===========================================================================
  // Starred Collections
  // ===========================================================================

  getStarredCollections: t.procedure
    .input<GetStarredCollectionsInput>()
    .action(async ({ input }) => {
      return webAdeService.getStarredCollections(input.includeItems ?? true);
    }),

  getOwnerStarredCollections: t.procedure
    .input<GetOwnerStarredCollectionsInput>()
    .action(async ({ input }) => {
      return webAdeService.getOwnerStarredCollections(input.owner, input.includeItems ?? true);
    }),

  createCollection: t.procedure
    .input<CreateCollectionInput>()
    .action(async ({ input }) => {
      return webAdeService.createCollection(input.name, input.description, input.icon);
    }),

  addRepoToCollection: t.procedure
    .input<AddRepoToCollectionInput>()
    .action(async ({ input }) => {
      return webAdeService.addRepoToCollection(input.collectionId, input.owner, input.repo);
    }),

  removeRepoFromCollection: t.procedure
    .input<RemoveRepoFromCollectionInput>()
    .action(async ({ input }) => {
      return webAdeService.removeRepoFromCollection(input.collectionId, input.owner, input.repo);
    }),

  // ===========================================================================
  // Pinned Repositories
  // ===========================================================================

  getPinnedRepositories: t.procedure
    .input<GetPinnedRepositoriesInput>()
    .action(async ({ input }) => {
      return webAdeService.getPinnedRepositories(input.username);
    }),

  // ===========================================================================
  // AI Explain Commits
  // ===========================================================================

  explainCommits: t.procedure
    .input<ExplainCommitsInput>()
    .action(async ({ input }) => {
      return webAdeService.explainCommits(input);
    }),

  explainWorkingChanges: t.procedure
    .input<ExplainWorkingChangesInput>()
    .action(async ({ input }) => {
      return webAdeService.explainWorkingChanges(input);
    }),
};
