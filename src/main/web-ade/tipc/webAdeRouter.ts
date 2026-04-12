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
      return webAdeService.watchUser(input.login);
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
};
