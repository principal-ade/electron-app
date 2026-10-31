import { createHash } from 'crypto';
import type { DraftTopic } from '@principal-ai/subsystems-core/node';

/** Opaque content revision, including changes made outside this process. */
export function topicRevision(topic: DraftTopic): string {
  return createHash('sha256').update(JSON.stringify(topic)).digest('hex');
}

export class TopicUpdateConflictError extends Error {
  constructor(public readonly topic: DraftTopic) {
    super('Topic changed. Fetch it again and reapply your edits.');
  }
}

export class TopicNotFoundError extends Error {
  constructor() {
    super('unknown topic id');
  }
}
