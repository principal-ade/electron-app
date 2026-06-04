/**
 * TIPC Client for Topic operations.
 *
 * Type-safe RPC for topic management, replacing legacy ipcRenderer.invoke
 * via TopicService. Method names are prefixed with `topic_` to avoid
 * collisions with other routers.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  AddTrailInput,
  AppendDescriptionInput,
  CreateTopicInput,
  DeleteTopicInput,
  FetchSharedTopicInput,
  FetchSharedTopicResult,
  GetTopicInput,
  GetTopicsForTrailInput,
  LinkSessionInput,
  LinkSessionResult,
  LocalTopicRecord,
  PublishTopicInput,
  PublishTopicResult,
  RemoveTrailInput,
  ReorderTrailsInput,
  Topic,
  TopicRouterType,
  UpdateTopicInputArgs,
} from '../../shared/tipc/topicRouterTypes';
import {
  TopicAPIEvent,
  type SessionLinkedEvent,
} from '../../shared/main-process-api-interfaces/TopicAPI';

export interface TopicClient {
  getTopics: () => Promise<Topic[]>;
  getTopic: (input: GetTopicInput) => Promise<Topic | null>;
  createTopic: (input: CreateTopicInput) => Promise<Topic>;
  updateTopic: (input: UpdateTopicInputArgs) => Promise<Topic>;
  /** Append text to the bottom of a topic's markdown description. */
  appendDescription: (input: AppendDescriptionInput) => Promise<Topic>;
  deleteTopic: (input: DeleteTopicInput) => Promise<boolean>;
  addTrailToTopic: (input: AddTrailInput) => Promise<Topic>;
  removeTrailFromTopic: (input: RemoveTrailInput) => Promise<Topic>;
  reorderTopicTrails: (input: ReorderTrailsInput) => Promise<Topic>;
  getTopicsForTrail: (input: GetTopicsForTrailInput) => Promise<Topic[]>;
  getRecord: (input: GetTopicInput) => Promise<LocalTopicRecord | null>;
  getRecords: () => Promise<LocalTopicRecord[]>;
  /** Hydrate a topic published to web-ade by id. Throws on 404 / no-access. */
  fetchSharedById: (
    input: FetchSharedTopicInput,
  ) => Promise<FetchSharedTopicResult>;
  /** Publish a local topic to web-ade. Throws on failure (e.g. unshared trail). */
  publishTopic: (input: PublishTopicInput) => Promise<PublishTopicResult>;
  getSessionLinks: () => Promise<Record<string, string>>;
  /**
   * User-initiated session→topic link. Idempotent — returns
   * `{ changed: false }` if the session was already linked to this topic.
   * On change, main broadcasts SESSION_LINKED so `onSessionLinked`
   * subscribers refresh.
   */
  linkSession: (input: LinkSessionInput) => Promise<LinkSessionResult>;
  /**
   * Subscribe to session-link broadcasts. Fires after a new
   * `{sessionId → topicId}` row is written to disk by the hook pipeline
   * (idempotent re-links are filtered out in main).
   * @returns Unsubscribe function.
   */
  onSessionLinked: (
    callback: (event: SessionLinkedEvent) => void,
  ) => () => void;
}

interface TipcTopicClient {
  topic_getTopics: () => Promise<Topic[]>;
  topic_getTopic: (input: GetTopicInput) => Promise<Topic | null>;
  topic_createTopic: (input: CreateTopicInput) => Promise<Topic>;
  topic_updateTopic: (input: UpdateTopicInputArgs) => Promise<Topic>;
  topic_appendDescription: (input: AppendDescriptionInput) => Promise<Topic>;
  topic_deleteTopic: (input: DeleteTopicInput) => Promise<boolean>;
  topic_addTrailToTopic: (input: AddTrailInput) => Promise<Topic>;
  topic_removeTrailFromTopic: (input: RemoveTrailInput) => Promise<Topic>;
  topic_reorderTopicTrails: (input: ReorderTrailsInput) => Promise<Topic>;
  topic_getTopicsForTrail: (input: GetTopicsForTrailInput) => Promise<Topic[]>;
  topic_getRecord: (input: GetTopicInput) => Promise<LocalTopicRecord | null>;
  topic_getRecords: () => Promise<LocalTopicRecord[]>;
  topic_fetchSharedById: (
    input: FetchSharedTopicInput,
  ) => Promise<FetchSharedTopicResult>;
  topic_publishTopic: (
    input: PublishTopicInput,
  ) => Promise<PublishTopicResult>;
  topic_getSessionLinks: () => Promise<Record<string, string>>;
  topic_linkSession: (input: LinkSessionInput) => Promise<LinkSessionResult>;
}

let _tipcClient: TipcTopicClient | null = null;

function getTipcClient(): TipcTopicClient {
  if (!_tipcClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'Topic client not available - window.electron not initialized',
      );
    }
    _tipcClient = createClient<TopicRouterType>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as TipcTopicClient;
  }
  return _tipcClient;
}

export const topicClient: TopicClient = {
  getTopics: () => getTipcClient().topic_getTopics(),
  getTopic: (input) => getTipcClient().topic_getTopic(input),
  createTopic: (input) => getTipcClient().topic_createTopic(input),
  updateTopic: (input) => getTipcClient().topic_updateTopic(input),
  appendDescription: (input) => getTipcClient().topic_appendDescription(input),
  deleteTopic: (input) => getTipcClient().topic_deleteTopic(input),
  addTrailToTopic: (input) => getTipcClient().topic_addTrailToTopic(input),
  removeTrailFromTopic: (input) =>
    getTipcClient().topic_removeTrailFromTopic(input),
  reorderTopicTrails: (input) =>
    getTipcClient().topic_reorderTopicTrails(input),
  getTopicsForTrail: (input) => getTipcClient().topic_getTopicsForTrail(input),
  getRecord: (input) => getTipcClient().topic_getRecord(input),
  getRecords: () => getTipcClient().topic_getRecords(),
  fetchSharedById: (input) => getTipcClient().topic_fetchSharedById(input),
  publishTopic: (input) => getTipcClient().topic_publishTopic(input),
  getSessionLinks: () => getTipcClient().topic_getSessionLinks(),
  linkSession: (input) => getTipcClient().topic_linkSession(input),
  onSessionLinked: (callback) => {
    return window.electron.ipcRenderer.on(
      TopicAPIEvent.SESSION_LINKED,
      (...args: unknown[]) => {
        const event = args[0] as SessionLinkedEvent | undefined;
        if (!event) return;
        callback(event);
      },
    );
  },
};

export type {
  CreateTopicInput,
  UpdateTopicInputArgs,
  LocalTopicRecord,
  Topic,
};
