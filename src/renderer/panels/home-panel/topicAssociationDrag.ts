/**
 * Topic association drag-and-drop for the Home rail.
 *
 * Home rows already drag a plain-text agent prompt for terminals. Rows that can
 * be associated with a topic (saved drawings, subsystem models, topics) also
 * carry a typed payload under {@link TOPIC_ASSOCIATION_MIME}, which topic rows
 * accept as a drop to attach the item to that topic.
 */
import type { TopicReference } from '@principal-ai/subsystems-core';
import { TopicService } from '../../main-process-api/TopicService';
import type { HomeTabEntry } from './homeTabEntries';

export const TOPIC_ASSOCIATION_MIME =
  'application/x-principal-topic-association';

export type TopicAssociation =
  | { kind: 'drawing'; drawingId: string }
  | { kind: 'subsystem-model'; modelId: string }
  | { kind: 'topic'; topicId: string };

export type TopicAssociationResult = 'added' | 'exists' | 'self';

// dataTransfer contents can't be read during dragover, only its types. The
// in-app drag source is remembered here so a topic row can refuse a drop of
// itself before the user lets go.
let activeDrag: TopicAssociation | null = null;

export function setActiveTopicAssociationDrag(
  association: TopicAssociation | null,
): void {
  activeDrag = association;
}

export function getActiveTopicAssociationDrag(): TopicAssociation | null {
  return activeDrag;
}

/** The association a Home entry can offer, or null when it can't be attached. */
export function associationFromEntry(
  entry: HomeTabEntry,
): TopicAssociation | null {
  switch (entry.kind) {
    case 'drawing':
      // Unsaved drawings have no file yet and keep a temporary `new-` id.
      return entry.drawingId &&
        entry.path &&
        !entry.drawingId.startsWith('new-')
        ? { kind: 'drawing', drawingId: entry.drawingId }
        : null;
    case 'subsystem-model':
      return entry.modelId
        ? { kind: 'subsystem-model', modelId: entry.modelId }
        : null;
    case 'topic':
      return entry.topicId ? { kind: 'topic', topicId: entry.topicId } : null;
    default:
      return null;
  }
}

export function hasTopicAssociation(
  dataTransfer: DataTransfer | null,
): boolean {
  return Array.from(dataTransfer?.types ?? []).includes(TOPIC_ASSOCIATION_MIME);
}

/** Parse a dropped payload, rejecting anything that isn't a known association. */
export function readTopicAssociation(
  dataTransfer: DataTransfer | null,
): TopicAssociation | null {
  const raw = dataTransfer?.getData(TOPIC_ASSOCIATION_MIME);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = (field: string) =>
    typeof record[field] === 'string' && record[field] !== ''
      ? (record[field] as string)
      : null;
  switch (record.kind) {
    case 'drawing': {
      const drawingId = id('drawingId');
      return drawingId ? { kind: 'drawing', drawingId } : null;
    }
    case 'subsystem-model': {
      const modelId = id('modelId');
      return modelId ? { kind: 'subsystem-model', modelId } : null;
    }
    case 'topic': {
      const topicId = id('topicId');
      return topicId ? { kind: 'topic', topicId } : null;
    }
    default:
      return null;
  }
}

export function isSelfAssociation(
  topicId: string,
  association: TopicAssociation | null,
): boolean {
  return association?.kind === 'topic' && association.topicId === topicId;
}

/**
 * Attach an item to a topic: drawings and topics go in `references`, models in
 * `subsystemModels`. Existing entries are kept and duplicates are not re-added.
 */
export async function associateWithTopic(
  topicId: string,
  association: TopicAssociation,
): Promise<TopicAssociationResult> {
  if (isSelfAssociation(topicId, association)) return 'self';
  const topic = await TopicService.getTopic(topicId);
  if (!topic) throw new Error(`Topic ${topicId} not found`);

  if (association.kind === 'subsystem-model') {
    const models = topic.subsystemModels ?? [];
    if (models.some((ref) => ref.modelId === association.modelId)) {
      return 'exists';
    }
    await TopicService.updateTopic(topicId, {
      subsystemModels: [...models, { modelId: association.modelId }],
    });
    return 'added';
  }

  const reference: TopicReference =
    association.kind === 'drawing'
      ? { kind: 'drawing', drawingId: association.drawingId }
      : { kind: 'topic', topicId: association.topicId };
  const references = topic.references ?? [];
  const exists = references.some((ref) =>
    ref.kind === 'drawing' && reference.kind === 'drawing'
      ? ref.drawingId === reference.drawingId
      : ref.kind === 'topic' && reference.kind === 'topic'
        ? ref.topicId === reference.topicId
        : false,
  );
  if (exists) return 'exists';
  await TopicService.updateTopic(topicId, {
    references: [...references, reference],
  });
  return 'added';
}
