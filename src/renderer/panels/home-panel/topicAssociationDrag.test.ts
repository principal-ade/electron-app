/// <reference types="jest" />
import { TopicService } from '../../main-process-api/TopicService';
import type { HomeTabEntry } from './homeTabEntries';
import {
  associateWithTopic,
  associationFromEntry,
  readTopicAssociation,
  TOPIC_ASSOCIATION_MIME,
} from './topicAssociationDrag';

jest.mock('../../main-process-api/TopicService', () => ({
  TopicService: { getTopic: jest.fn(), updateTopic: jest.fn() },
}));

const getTopic = TopicService.getTopic as jest.Mock;
const updateTopic = TopicService.updateTopic as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('associationFromEntry', () => {
  const base = { id: 'x', label: 'X' };
  test.each<[HomeTabEntry, unknown]>([
    [
      { ...base, kind: 'drawing', drawingId: 'd1', path: '/d/d1.excalidraw' },
      { kind: 'drawing', drawingId: 'd1' },
    ],
    [
      {
        ...base,
        kind: 'drawing',
        drawingId: 'new-123',
        path: '/d/new.excalidraw',
      },
      null,
    ],
    [{ ...base, kind: 'drawing', drawingId: 'd1' }, null],
    [
      { ...base, kind: 'subsystem-model', modelId: 'sg-1' },
      { kind: 'subsystem-model', modelId: 'sg-1' },
    ],
    [
      { ...base, kind: 'topic', topicId: 't1' },
      { kind: 'topic', topicId: 't1' },
    ],
    [{ ...base, kind: 'topic' }, null],
    [{ ...base, kind: 'terminal', path: '/tmp' }, null],
  ])('%p → %p', (entry, expected) => {
    expect(associationFromEntry(entry)).toEqual(expected);
  });
});

describe('readTopicAssociation', () => {
  const transfer = (raw: string) =>
    ({
      getData: (type: string) => (type === TOPIC_ASSOCIATION_MIME ? raw : ''),
    }) as unknown as DataTransfer;

  test('parses known kinds', () => {
    expect(
      readTopicAssociation(transfer('{"kind":"drawing","drawingId":"d1"}')),
    ).toEqual({ kind: 'drawing', drawingId: 'd1' });
  });

  test.each([
    '',
    'not json',
    'null',
    '{"kind":"repo","purl":"pkg:github/a/b"}',
    '{"kind":"drawing","drawingId":""}',
    '{"kind":"topic","topicId":42}',
  ])('rejects %p', (raw) => {
    expect(readTopicAssociation(transfer(raw))).toBeNull();
  });
});

describe('associateWithTopic', () => {
  const existing = {
    id: 'owner',
    references: [{ kind: 'c4-sketch', sketchId: 'c4s-1' }],
    subsystemModels: [{ modelId: 'sg-1', trailIds: ['flow'] }],
  };
  beforeEach(() => getTopic.mockResolvedValue(existing));

  test('appends a drawing reference, keeping existing references', async () => {
    await expect(
      associateWithTopic('owner', { kind: 'drawing', drawingId: 'd1' }),
    ).resolves.toBe('added');
    expect(updateTopic).toHaveBeenCalledWith('owner', {
      references: [
        ...existing.references,
        { kind: 'drawing', drawingId: 'd1' },
      ],
    });
  });

  test('appends a related topic', async () => {
    await expect(
      associateWithTopic('owner', { kind: 'topic', topicId: 't2' }),
    ).resolves.toBe('added');
    expect(updateTopic).toHaveBeenCalledWith('owner', {
      references: [...existing.references, { kind: 'topic', topicId: 't2' }],
    });
  });

  test('appends a subsystem model, keeping existing trail scopes', async () => {
    await expect(
      associateWithTopic('owner', { kind: 'subsystem-model', modelId: 'sg-2' }),
    ).resolves.toBe('added');
    expect(updateTopic).toHaveBeenCalledWith('owner', {
      subsystemModels: [...existing.subsystemModels, { modelId: 'sg-2' }],
    });
  });

  test('does not re-add existing associations', async () => {
    getTopic.mockResolvedValue({
      ...existing,
      references: [
        { kind: 'drawing', drawingId: 'd1' },
        { kind: 'topic', topicId: 't2' },
      ],
    });
    for (const association of [
      { kind: 'drawing', drawingId: 'd1' },
      { kind: 'topic', topicId: 't2' },
      { kind: 'subsystem-model', modelId: 'sg-1' },
    ] as const) {
      await expect(associateWithTopic('owner', association)).resolves.toBe(
        'exists',
      );
    }
    expect(updateTopic).not.toHaveBeenCalled();
  });

  test('treats the same id under a different kind as new', async () => {
    getTopic.mockResolvedValue({
      references: [{ kind: 'topic', topicId: 'same' }],
    });
    await expect(
      associateWithTopic('owner', { kind: 'drawing', drawingId: 'same' }),
    ).resolves.toBe('added');
  });

  test('refuses to link a topic to itself without reading or writing', async () => {
    await expect(
      associateWithTopic('owner', { kind: 'topic', topicId: 'owner' }),
    ).resolves.toBe('self');
    expect(getTopic).not.toHaveBeenCalled();
    expect(updateTopic).not.toHaveBeenCalled();
  });

  test('throws for an unknown target topic', async () => {
    getTopic.mockResolvedValue(null);
    await expect(
      associateWithTopic('gone', { kind: 'drawing', drawingId: 'd1' }),
    ).rejects.toThrow('Topic gone not found');
    expect(updateTopic).not.toHaveBeenCalled();
  });
});
