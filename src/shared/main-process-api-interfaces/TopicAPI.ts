/**
 * IPC API interface for Topic management.
 *
 * Topics are local subject briefs. The canonical Topic shape lives in
 * @principal-ai/subsystems-core (DraftTopic).
 */

import type {
  DraftTopic as Topic,
  TopicAsset,
  TopicStatus,
} from '@principal-ai/subsystems-core/node';

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
  TOPIC_ADDED = 'topic:topic-added',
  TOPIC_UPDATED = 'topic:topic-updated',
  TOPIC_REMOVED = 'topic:topic-removed',
  /** Fired after a sessionId → topicId entry is written to disk. */
  SESSION_LINKED = 'topic:session-linked',
  /**
   * Sent to a single window's webContents (the focused one, resolved by the
   * bridge's activate route) asking its renderer to surface a topic. Unlike
   * the `TOPIC_*` broadcasts above, this is point-to-point, not fan-out.
   */
  TOPIC_ACTIVATE = 'topic:activate',
}

/** Payload broadcast on {@link TopicAPIEvent.SESSION_LINKED}. */
export interface SessionLinkedEvent {
  sessionId: string;
  topicId: string;
}

/** Payload sent on {@link TopicAPIEvent.TOPIC_ACTIVATE}. */
export interface TopicActivateEvent {
  topicId: string;
  title?: string;
}

/** Input to {@link TopicAPI.createTopic} — id/timestamps generated when omitted. */
export interface CreateTopicInput {
  title: string;
  description?: string;
  createdBy?: { githubId: number; githubLogin: string };
  /** Optional explicit id; defaults to a locally generated one. */
  id?: string;
  /** Optional initial workflow status; defaults to absent (treated as `active`). */
  status?: TopicStatus;
  /**
   * Repositories this topic is about, as PURL strings (e.g.
   * `pkg:github/owner/repo`). Declared by the topic itself.
   */
  repos?: string[];
}

/** Input to {@link TopicAPI.updateTopic} — partial patch. */
export interface UpdateTopicInput {
  title?: string;
  description?: string;
  createdBy?: { githubId: number; githubLogin: string };
  /**
   * New workflow status, persisted as part of the local topic.
   */
  status?: TopicStatus;
  /** Images attached to the topic (see {@link TopicAsset}). */
  assets?: TopicAsset[];
  /**
   * Replace the topic's repositories (PURL strings, e.g.
   * `pkg:github/owner/repo`). The workspace↔topic sync mirrors repo membership
   * here; a caller may also set it directly.
   */
  repos?: string[];
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

  /** Patch title/description/createdBy. */
  updateTopic(id: string, updates: UpdateTopicInput): Promise<Topic>;

  /** Permanently delete a topic. */
  deleteTopic(id: string): Promise<boolean>;
}
