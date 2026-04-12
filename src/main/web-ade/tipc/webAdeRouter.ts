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
};
