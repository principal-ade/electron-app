/**
 * IPC API interface for Topic management.
 *
 * Topics are curated bundles of trails on a single subject. The canonical
 * Topic shape lives in @principal-ai/alexandria-core-library; on the
 * desktop we wrap it in a LocalTopicRecord that carries sync metadata
 * (origin, remoteId, visibility, timestamps). Most consumers only need
 * the Topic; sync UIs ask for the full LocalTopicRecord.
 */

import type { Topic } from '@principal-ai/alexandria-core-library';

/**
 * Sync metadata layered on top of the canonical Topic. Local-only — never
 * crosses to the server. The web-ade Topic shape stays clean by living
 * inside `topic`; this wrapper carries everything sync-related around it.
 */
export interface LocalTopicSync {
  /** Where this record came from. `'local'` until we pull from remote. */
  origin: 'local' | 'remote';
  /** Server-assigned id, once published. Absent on local-only topics. */
  remoteId?: string;
  /**
   * User intent for sharing. `'private'` = never auto-suggest publish;
   * `'sharable'` = ok to push. Defaults to `'sharable'` for v1.
   */
  visibility: 'private' | 'sharable';
  /** ISO 8601. Last successful push or pull. */
  lastSyncedAt?: string;
  /** ISO 8601. Local mtime for dirty detection vs lastSyncedAt. */
  locallyModifiedAt: string;
}

export interface LocalTopicRecord {
  topic: Topic;
  sync: LocalTopicSync;
}

export enum TopicEventType {
  ADDED = 'added',
  UPDATED = 'updated',
  REMOVED = 'removed',
}

export interface TopicChangeEvent {
  type: TopicEventType;
  topic?: Topic;
  id?: string;
}

export enum TopicAPIEvent {
  GET_ALL = 'topic:get-all',
  GET = 'topic:get',
  CREATE = 'topic:create',
  UPDATE = 'topic:update',
  DELETE = 'topic:delete',
  ADD_TRAIL = 'topic:add-trail',
  REMOVE_TRAIL = 'topic:remove-trail',
  REORDER_TRAILS = 'topic:reorder-trails',
  GET_FOR_TRAIL = 'topic:get-for-trail',
  TOPIC_ADDED = 'topic:topic-added',
  TOPIC_UPDATED = 'topic:topic-updated',
  TOPIC_REMOVED = 'topic:topic-removed',
  /** Fired after a sessionId → topicId entry is written to disk. */
  SESSION_LINKED = 'topic:session-linked',
}

/** Payload broadcast on {@link TopicAPIEvent.SESSION_LINKED}. */
export interface SessionLinkedEvent {
  sessionId: string;
  topicId: string;
}

/** Input to {@link TopicAPI.createTopic} — id/timestamps generated when omitted. */
export interface CreateTopicInput {
  title: string;
  description?: string;
  trailIds?: string[];
  createdBy?: { githubId: number; githubLogin: string };
  /** Optional explicit id; defaults to a locally generated one. */
  id?: string;
  /** Optional visibility intent; defaults to `'sharable'`. */
  visibility?: 'private' | 'sharable';
}

/** Input to {@link TopicAPI.updateTopic} — partial patch. */
export interface UpdateTopicInput {
  title?: string;
  description?: string;
  createdBy?: { githubId: number; githubLogin: string };
  visibility?: 'private' | 'sharable';
}

export interface TopicAPI {
  /**
   * Subscribe to topic change events.
   * @returns Unsubscribe function.
   */
  onTopicChange(callback: (event: TopicChangeEvent) => void): () => void;

  /** Get all topics, oldest first. */
  getTopics(): Promise<Topic[]>;

  /** Get a single topic by id, or null if missing. */
  getTopic(id: string): Promise<Topic | null>;

  /** Create a topic. Server-assigned ids round-trip via the optional `id`. */
  createTopic(input: CreateTopicInput): Promise<Topic>;

  /** Patch title/description/visibility/createdBy. */
  updateTopic(id: string, updates: UpdateTopicInput): Promise<Topic>;

  /** Permanently delete a topic. Does not cascade to trails. */
  deleteTopic(id: string): Promise<boolean>;

  /** Append a trail to the topic's ordered list. Idempotent. */
  addTrailToTopic(topicId: string, trailId: string): Promise<Topic>;

  /** Remove a trail from the topic. Idempotent. */
  removeTrailFromTopic(topicId: string, trailId: string): Promise<Topic>;

  /** Replace the trail list with a permutation of the existing one. */
  reorderTopicTrails(topicId: string, trailIds: string[]): Promise<Topic>;

  /** Find topics that include the given trail. */
  getTopicsForTrail(trailId: string): Promise<Topic[]>;
}
