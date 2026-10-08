/**
 * Shared types for the Topic TIPC Router.
 *
 * Method names are prefixed with `topic_` to avoid collisions with other
 * routers and so the renderer's TIPC client surface is searchable.
 */

import type { ActionContext } from '@egoist/tipc/main';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import type {
  CreateTopicInput,
  UpdateTopicInput,
} from '../main-process-api-interfaces/TopicAPI';

// =============================================================================
// Re-export domain types
// =============================================================================

export type {
  Topic,
  CreateTopicInput,
  UpdateTopicInput,
};

export type {
  TopicChangeEvent,
  TopicEventType,
} from '../main-process-api-interfaces/TopicAPI';

// =============================================================================
// Input types
// =============================================================================

export interface GetTopicInput {
  id: string;
}

export interface UpdateTopicInputArgs {
  id: string;
  updates: UpdateTopicInput;
}

export interface AppendDescriptionInput {
  id: string;
  /** Text appended to the bottom of the description (blank-line separated). */
  text: string;
}

/**
 * A content-hashed image attached to a topic, carried from the desktop
 * drag-drop path. Mirrors the planned `TopicAsset` in alexandria-core-library
 * (see docs/topic-images-feature.md) minus the fields the desktop path doesn't
 * populate (`url`, `source`).
 */
export interface TopicImageAssetInput {
  /** Content hash (SHA-256 hex) — dedup key + the `asset://` target. */
  id: string;
  /** e.g. "image/png". */
  mime: string;
  /** Base64-encoded bytes (no `data:` prefix). */
  data: string;
  /** Markdown alt text. */
  alt?: string;
}

export interface AttachImageAssetInput {
  topicId: string;
  asset: TopicImageAssetInput;
}

export interface DeleteTopicInput {
  id: string;
}

export interface LinkSessionInput {
  topicId: string;
  sessionId: string;
}

export interface LinkSessionResult {
  changed: boolean;
}

// =============================================================================
// Router type
// =============================================================================

export type TopicRouterType = Record<
  string,
  {
    action: (args: {
      context: ActionContext;
      input: unknown;
    }) => Promise<unknown>;
  }
> & {
  topic_getTopics: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<Topic[]>;
  };
  topic_getTopic: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInput;
    }) => Promise<Topic | null>;
  };
  topic_createTopic: {
    action: (args: {
      context: ActionContext;
      input: CreateTopicInput;
    }) => Promise<Topic>;
  };
  topic_updateTopic: {
    action: (args: {
      context: ActionContext;
      input: UpdateTopicInputArgs;
    }) => Promise<Topic>;
  };
  topic_appendDescription: {
    action: (args: {
      context: ActionContext;
      input: AppendDescriptionInput;
    }) => Promise<Topic>;
  };
  topic_attachImageAsset: {
    action: (args: {
      context: ActionContext;
      input: AttachImageAssetInput;
    }) => Promise<Topic>;
  };
  topic_deleteTopic: {
    action: (args: {
      context: ActionContext;
      input: DeleteTopicInput;
    }) => Promise<boolean>;
  };
  topic_getTopicFilePath: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInput;
    }) => Promise<string | null>;
  };
  topic_getSessionLinks: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<Record<string, string>>;
  };
  topic_linkSession: {
    action: (args: {
      context: ActionContext;
      input: LinkSessionInput;
    }) => Promise<LinkSessionResult>;
  };
};
