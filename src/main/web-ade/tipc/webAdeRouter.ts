/**
 * TIPC Router for Web-ADE Operations
 *
 * Type-safe RPC for Web-ADE API interactions.
 * Follows the same pattern as githubRouter.
 */

import { tipc } from '@egoist/tipc/main';
import type {
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
  GetTopicInboxInput,
} from '../../../shared/tipc/webAdeRouterTypes';
import { WebAdeService } from '../../services/WebAdeService';
import { requireHostedFeature } from '../../services/FeatureAvailabilityService';

// Create a shared service instance
const webAdeService = new WebAdeService();

const t = tipc.create();

export const webAdeRouter = {
  // ===========================================================================
  // Authentication
  // ===========================================================================

  isAuthenticated: t.procedure.action(async () => {
    await requireHostedFeature('signIn');
    return webAdeService.isAuthenticated();
  }),

  // ===========================================================================
  // GitHub Tree API (via web-ade's cached endpoint)
  // ===========================================================================

  getGithubTree: t.procedure
    .input<GetTreeInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getGithubTree(input);
    }),

  // ===========================================================================
  // GitHub Repository Contributions (via web-ade)
  // ===========================================================================

  getRepoContributions: t.procedure
    .input<GetRepoContributionsInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getRepoContributions(input);
    }),

  // ===========================================================================
  // User Activity
  // ===========================================================================

  getUserActivity: t.procedure
    .input<GetUserActivityInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getUserActivity(input);
    }),

  // ===========================================================================
  // Starred Collections
  // ===========================================================================

  getStarredCollections: t.procedure
    .input<GetStarredCollectionsInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getStarredCollections(input.includeItems ?? true);
    }),

  getOwnerStarredCollections: t.procedure
    .input<GetOwnerStarredCollectionsInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getOwnerStarredCollections(input.owner, input.includeItems ?? true);
    }),

  createCollection: t.procedure
    .input<CreateCollectionInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.createCollection(input.name, input.description, input.icon);
    }),

  addRepoToCollection: t.procedure
    .input<AddRepoToCollectionInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.addRepoToCollection(input.collectionId, input.owner, input.repo);
    }),

  removeRepoFromCollection: t.procedure
    .input<RemoveRepoFromCollectionInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.removeRepoFromCollection(input.collectionId, input.owner, input.repo);
    }),

  // ===========================================================================
  // Pinned Repositories
  // ===========================================================================

  getPinnedRepositories: t.procedure
    .input<GetPinnedRepositoriesInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.getPinnedRepositories(input.username);
    }),

  // ===========================================================================
  // AI Explain Commits
  // ===========================================================================

  explainCommits: t.procedure
    .input<ExplainCommitsInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.explainCommits(input);
    }),

  explainWorkingChanges: t.procedure
    .input<ExplainWorkingChangesInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('repositoryInsightsAndCollections');
      return webAdeService.explainWorkingChanges(input);
    }),

  // ===========================================================================
  // ===========================================================================
  // Topic Inbox
  // ===========================================================================

  getTopicInbox: t.procedure
    .input<GetTopicInboxInput>()
    .action(async ({ input }) => {
      await requireHostedFeature('topicSharing');
      return webAdeService.getTopicInbox(input);
    }),

  getTopicInboxUnreadCount: t.procedure.action(async () => {
    await requireHostedFeature('topicSharing');
    return webAdeService.getTopicInboxUnreadCount();
  }),
};
