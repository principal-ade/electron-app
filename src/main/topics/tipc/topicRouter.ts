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
  AppendDescriptionInput,
  AttachImageAssetInput,
  DeleteTopicInput,
  FetchSharedTopicInput,
  GetTopicInput,
  GetTopicsForTrailInput,
  LinkSessionInput,
  PublishTopicInput,
  RemoveTrailInput,
  ReorderTrailsInput,
  UpdateTopicInputArgs,
} from '../../../shared/tipc/topicRouterTypes';
import { fetchSharedTopicById } from '../topicShare';
import type { SessionLinkedEvent } from '../../../shared/main-process-api-interfaces/TopicAPI';
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

  // Hydrate a topic published to web-ade by id. Unlike the queries above
  // (which read the local registry), this reaches the shared registry over
  // HTTP — the inbox's topic tab opens topics that may not exist locally.
  topic_fetchSharedById: t.procedure
    .input<FetchSharedTopicInput>()
    .action(async ({ input }) => {
      return fetchSharedTopicById(input.id);
    }),

  // Publish a local topic to web-ade and stamp its server id onto sync
  // metadata. Broadcast UPDATED so list/detail views reflect the now-shared
  // state. Throws (rejecting the publish) when a referenced trail isn't
  // shared yet — the renderer surfaces the typed error.
  topic_publishTopic: t.procedure
    .input<PublishTopicInput>()
    .action(async ({ input }) => {
      const result = await registryService.publishTopic(input.id);
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, result.record.topic);
      return result;
    }),

  topic_getRecord: t.procedure
    .input<GetTopicInput>()
    .action(async ({ input }) => {
      return registryService.getRecord(input.id);
    }),

  // Absolute on-disk path of the topic's JSON in the file-per-topic store.
  // Returns null for an unknown topic or while the legacy blob is still the
  // backend. Backs the topic header's "Copy path" action.
  topic_getTopicFilePath: t.procedure
    .input<GetTopicInput>()
    .action(async ({ input }) => {
      return registryService.getTopicFilePath(input.id);
    }),

  topic_getRecords: t.procedure.action(async () => {
    return registryService.getRecords();
  }),

  topic_getSessionLinks: t.procedure.action(async () => {
    return registryService.getSessionLinks();
  }),

  // Migrate topics from the legacy ~/.alexandria/topics.json blob to the
  // file-per-topic store. Triggered by the Settings action; idempotent (a
  // second run reports noLegacyBlob). Returns the migration summary so the
  // Settings UI can report how many topics moved.
  topic_migrateTopics: t.procedure.action(async () => {
    return registryService.migrateTopics();
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

  // Append text to the bottom of the topic's markdown description, preserving
  // existing content with a blank-line separator. Mirrors the HTTP
  // /api/topics/:id/description/append route (used by agents) so the UI's
  // drag-to-notes path and agent writes converge on identical semantics.
  topic_appendDescription: t.procedure
    .input<AppendDescriptionInput>()
    .action(async ({ input }) => {
      const text = typeof input.text === 'string' ? input.text : '';
      if (text.trim().length === 0) {
        throw new Error('text (non-empty string) is required');
      }
      const existing = await registryService.getTopic(input.id);
      if (!existing) {
        throw new Error(`Unknown topic id: ${input.id}`);
      }
      const prior = (existing.description ?? '').replace(/\s+$/, '');
      const description =
        prior.length > 0 ? `${prior}\n\n${text}` : text;
      const topic = await registryService.updateTopic(input.id, { description });
      broadcastTopicEvent(TopicAPIEvent.TOPIC_UPDATED, topic);
      return topic;
    }),

  // Attach a screenshot dragged into the description: store the bytes inline on
  // the topic (deduped by content hash) and append the `asset://` reference the
  // themed-markdown resolver swaps for an <img> at render. Atomic read-modify-
  // write + broadcast, mirroring topic_appendDescription.
  //
  // Published topics are rejected for now: pushing assets to web-ade is Slice 2
  // (see the feature doc), and the updateTopic write-through gate would send the
  // `asset://` ref to the remote where it has no bytes to resolve.
  topic_attachImageAsset: t.procedure
    .input<AttachImageAssetInput>()
    .action(async ({ input }) => {
      const { topicId, asset } = input;
      if (!asset?.id || !asset.data || !asset.mime) {
        throw new Error('asset (id, mime, data) is required');
      }

      const record = await registryService.getRecord(topicId);
      if (!record) {
        throw new Error(`Unknown topic id: ${topicId}`);
      }
      if (record.sync.remoteId) {
        throw new Error(
          'Attaching images to a published topic is not supported yet',
        );
      }

      const existing = record.topic;
      // Content-hash dedup: the same screenshot dropped twice is stored once and
      // referenced N times from the description.
      const current = existing.assets ?? [];
      const assets = current.some((a) => a.id === asset.id)
        ? current
        : [...current, asset];

      const ref = `![${asset.alt ?? 'image'}](asset://${asset.id})`;
      const prior = (existing.description ?? '').replace(/\s+$/, '');
      const description = prior.length > 0 ? `${prior}\n\n${ref}` : ref;

      const topic = await registryService.updateTopic(topicId, {
        description,
        assets,
      });
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

  // User-initiated session→topic link from the SessionsPanel. Mirrors the
  // fire-and-forget path in EventServerManager.handleLinkSessionToTopic:
  // idempotent in the registry, and we only broadcast SESSION_LINKED when
  // the link actually changed.
  topic_linkSession: t.procedure
    .input<LinkSessionInput>()
    .action(async ({ input }) => {
      const changed = registryService.linkSession(input.topicId, input.sessionId);
      if (changed) {
        const payload: SessionLinkedEvent = {
          sessionId: input.sessionId,
          topicId: input.topicId,
        };
        for (const win of BrowserWindow.getAllWindows()) {
          if (win.isDestroyed()) continue;
          win.webContents.send(TopicAPIEvent.SESSION_LINKED, payload);
        }
      }
      return { changed };
    }),
};

export type TopicRouter = typeof topicRouter;
