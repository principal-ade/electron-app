/**
 * TIPC Router for Topic operations.
 *
 * Method names are prefixed with `topic_` to avoid collisions with other
 * routers. Mutations broadcast `topic:topic-added | -updated | -removed`
 * to all live windows via `webContents.send`.
 */

import { tipc } from '@egoist/tipc/main';
import { BrowserWindow } from 'electron';
import type { Topic } from '@principal-ai/alexandria-core-library';
import { TopicRegistryService } from '../../stores/TopicRegistryService';
import { TopicAPIEvent } from '../../../shared/main-process-api-interfaces/TopicAPI';
import type {
  AddTrailInput,
  DeleteTopicInput,
  GetTopicInput,
  GetTopicsForTrailInput,
  RemoveTrailInput,
  ReorderTrailsInput,
  UpdateTopicInputArgs,
} from '../../../shared/tipc/topicRouterTypes';
import type { CreateTopicInput } from '../../../shared/main-process-api-interfaces/TopicAPI';

const registryService = TopicRegistryService.getInstance();
const t = tipc.create();

export function broadcastTopicEvent(
  eventType:
    | TopicAPIEvent.TOPIC_ADDED
    | TopicAPIEvent.TOPIC_UPDATED
    | TopicAPIEvent.TOPIC_REMOVED,
  data: Topic | { id: string },
): void {
  const windows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  windows.forEach((window) => {
    window.webContents.send(eventType, data);
  });
}

export const topicRouter = {
  // ===========================================================================
  // Queries
  // ===========================================================================

  topic_getTopics: t.procedure.action(async () => {
    return registryService.getTopics();
  }),

  topic_getTopic: t.procedure
    .input<GetTopicInput>()
    .action(async ({ input }) => {
      return registryService.getTopic(input.id);
    }),

  topic_getTopicsForTrail: t.procedure
    .input<GetTopicsForTrailInput>()
    .action(async ({ input }) => {
      return registryService.getTopicsForTrail(input.trailId);
    }),

  topic_getRecord: t.procedure
    .input<GetTopicInput>()
    .action(async ({ input }) => {
      return registryService.getRecord(input.id);
    }),

  topic_getRecords: t.procedure.action(async () => {
    return registryService.getRecords();
  }),

  topic_getSessionLinks: t.procedure.action(async () => {
    return registryService.getSessionLinks();
  }),

  // ===========================================================================
  // Mutations
  // ===========================================================================

  topic_createTopic: t.procedure
    .input<CreateTopicInput>()
    .action(async ({ input }) => {
      const topic = await registryService.createTopic(input);
      broadcastTopicEvent(TopicAPIEvent.TOPIC_ADDED, topic);
      return topic;
    }),

  topic_updateTopic: t.procedure
    .input<UpdateTopicInputArgs>()
    .action(async ({ input }) => {
      const topic = await registryService.updateTopic(input.id, input.updates);
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
      return topic;
    }),

  topic_deleteTopic: t.procedure
    .input<DeleteTopicInput>()
    .action(async ({ input }) => {
      const removed = await registryService.deleteTopic(input.id);
      if (removed) {
        broadcastTopicEvent(TopicAPIEvent.TOPIC_REMOVED, { id: input.id });
      }
      return removed;
    }),

  topic_addTrailToTopic: t.procedure
    .input<AddTrailInput>()
    .action(async ({ input }) => {
      const topic = await registryService.addTrailToTopic(
        input.topicId,
        input.trailId,
      );
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
      return topic;
    }),

  topic_removeTrailFromTopic: t.procedure
    .input<RemoveTrailInput>()
    .action(async ({ input }) => {
      const topic = await registryService.removeTrailFromTopic(
        input.topicId,
        input.trailId,
      );
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
      return topic;
    }),

  topic_reorderTopicTrails: t.procedure
    .input<ReorderTrailsInput>()
    .action(async ({ input }) => {
      const topic = await registryService.reorderTopicTrails(
        input.topicId,
        input.trailIds,
      );
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
      return topic;
    }),
};

export type TopicRouter = typeof topicRouter;
