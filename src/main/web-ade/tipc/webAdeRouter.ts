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
  GetUserActivityInput,
  GetPinnedRepositoriesInput,
  ExplainCommitsInput,
  ExplainWorkingChangesInput,
} from '../../../shared/tipc/webAdeRouterTypes';
import { WebAdeService } from '../../services/WebAdeService';
import { requireHostedFeature } from '../../services/FeatureAvailabilityService';

// Create a shared service instance
const webAdeService = new WebAdeService();

const t = tipc.create();

export const webAdeRouter = {
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

};
