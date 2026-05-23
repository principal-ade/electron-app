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
  LocalTopicRecord,
  UpdateTopicInput,
} from '../main-process-api-interfaces/TopicAPI';

// =============================================================================
// Re-export domain types
// =============================================================================

export type { Topic, CreateTopicInput, UpdateTopicInput, LocalTopicRecord };

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
  topic_getRecord: {
    action: (args: {
      context: ActionContext;
      input: GetTopicInput;
    }) => Promise<LocalTopicRecord | null>;
  };
  topic_getRecords: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<LocalTopicRecord[]>;
  };
};
