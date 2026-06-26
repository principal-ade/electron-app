/**
 * Shared types for the Topic TIPC Router.
 *
 * Method names are prefixed with `topic_` to avoid collisions with other
 * routers and so the renderer's TIPC client surface is searchable.
 */

import type { ActionContext } from '@egoist/tipc/main';
import type { Topic } from '@principal-ai/alexandria-core-library';
import type {
  CreateTopicInput,
  FetchSharedTopicResult,
  LocalTopicRecord,
  PublishTopicResult,
  UpdateTopicInput,
} from '../main-process-api-interfaces/TopicAPI';

// =============================================================================
// Re-export domain types
// =============================================================================

export type {
  Topic,
  CreateTopicInput,
  UpdateTopicInput,
  LocalTopicRecord,
  FetchSharedTopicResult,
  PublishTopicResult,
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

export interface AddTrailInput {
  topicId: string;
  trailId: string;
}

export interface RemoveTrailInput {
  topicId: string;
  trailId: string;
}

export interface ReorderTrailsInput {
  topicId: string;
  trailIds: string[];
}

export interface GetTopicsForTrailInput {
  trailId: string;
}

/** Input to {@link TopicRouterType.topic_fetchSharedById}. */
export interface FetchSharedTopicInput {
  id: string;
}

/** Input to {@link TopicRouterType.topic_publishTopic}. */
export interface PublishTopicInput {
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
  topic_addTrailToTopic: {
    action: (args: {
      context: ActionContext;
      input: AddTrailInput;
    }) => Promise<Topic>;
  };
  topic_removeTrailFromTopic: {
    action: (args: {
      context: ActionContext;
      input: RemoveTrailInput;
    }) => Promise<Topic>;
  };
  topic_reorderTopicTrails: {
    action: (args: {
      context: ActionContext;
      input: ReorderTrailsInput;
    }) => Promise<Topic>;
  };
  topic_getTopicsForTrail: {
    action: (args: {
      context: ActionContext;
      input: GetTopicsForTrailInput;
    }) => Promise<Topic[]>;
  };
  topic_fetchSharedById: {
    action: (args: {
      context: ActionContext;
      input: FetchSharedTopicInput;
    }) => Promise<FetchSharedTopicResult>;
  };
  topic_publishTopic: {
    action: (args: {
      context: ActionContext;
      input: PublishTopicInput;
    }) => Promise<PublishTopicResult>;
  };
  topic_getRecord: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInput;
    }) => Promise<LocalTopicRecord | null>;
  };
  topic_getTopicFilePath: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInput;
    }) => Promise<string | null>;
  };
  topic_getRecords: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<LocalTopicRecord[]>;
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
