/// <reference types="jest" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { homedir } from 'os';
import { join } from 'node:path';
import { TopicStore } from '@principal-ai/subsystems-core/node';
import { TopicRegistryService } from './TopicRegistryService';
import {
  topicRevision,
  TopicNotFoundError,
  TopicUpdateConflictError,
} from '../topics/topicRevision';

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(),
}));
jest.mock('@principal-ai/subsystems-core/node', () => ({
  TopicStore: jest.fn(),
  TOPICS_DIR: '/unused/topics',
}));

describe('TopicRegistryService deletion', () => {
  let directory: string;
  let service: TopicRegistryService;
  let deleteTopic: jest.Mock;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'topic-registry-'));
    (homedir as jest.Mock).mockReturnValue(directory);
    deleteTopic = jest.fn().mockResolvedValue(true);
    (TopicStore as jest.Mock).mockImplementation(() => ({ deleteTopic }));
    (
      TopicRegistryService as unknown as {
        instance: TopicRegistryService | undefined;
      }
    ).instance = undefined;
    service = TopicRegistryService.getInstance();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('removes every link to the deleted topic and preserves other sessions', async () => {
    service.linkSession('topic-a', 'session-1');
    service.linkSession('topic-a', 'session-2');
    service.linkSession('topic-b', 'session-3');

    expect(await service.deleteTopic('topic-a')).toBe(true);
    expect(deleteTopic).toHaveBeenCalledWith('topic-a');
    expect(service.getSessionLinks()).toEqual({ 'session-3': 'topic-b' });
    const persisted = JSON.parse(
      await readFile(
        join(directory, '.alexandria', 'topics-sync.json'),
        'utf8',
      ),
    );
    expect(persisted.sessionLinks).toEqual({ 'session-3': 'topic-b' });
  });

  it('also cleans stale links when the topic is already missing', async () => {
    service.linkSession('topic-a', 'session-1');
    deleteTopic.mockResolvedValue(false);

    expect(await service.deleteTopic('topic-a')).toBe(false);
    expect(service.getSessionLinks()).toEqual({});
  });

  it('does not unlink sessions if topic deletion throws', async () => {
    service.linkSession('topic-a', 'session-1');
    deleteTopic.mockRejectedValue(new Error('Disk unavailable'));

    await expect(service.deleteTopic('topic-a')).rejects.toThrow(
      'Disk unavailable',
    );
    expect(service.getSessionLinks()).toEqual({ 'session-1': 'topic-a' });
  });

  it('deletes a topic with no session metadata', async () => {
    expect(await service.deleteTopic('topic-a')).toBe(true);
    expect(service.getSessionLinks()).toEqual({});
  });
});

describe('TopicRegistryService conditional updates', () => {
  let service: TopicRegistryService;
  let current: {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  let updateTopic: jest.Mock;

  function currentTopic() {
    if (!current) throw new Error('Missing test topic');
    return current;
  }

  beforeEach(() => {
    current = {
      id: 'topic-a',
      title: 'Original',
      description: 'Original brief',
      createdAt: '2026-10-31T00:00:00.000Z',
      updatedAt: '2026-10-31T00:00:00.000Z',
    };
    updateTopic = jest.fn(async (_id, updates) => {
      await Promise.resolve();
      current = { ...currentTopic(), ...updates };
      return current;
    });
    (TopicStore as jest.Mock).mockImplementation(() => ({
      getTopic: jest.fn(async () => current && { ...current }),
      updateTopic,
    }));
    (homedir as jest.Mock).mockReturnValue('/unused');
    (
      TopicRegistryService as unknown as {
        instance: TopicRegistryService | undefined;
      }
    ).instance = undefined;
    service = TopicRegistryService.getInstance();
  });

  it('accepts a current revision without changing identity or omitted fields', async () => {
    const revision = topicRevision(currentTopic());
    await service.updateTopic('topic-a', { title: 'Updated' }, revision);
    expect(current).toMatchObject({
      id: 'topic-a',
      title: 'Updated',
      description: 'Original brief',
    });
    expect(updateTopic).toHaveBeenCalledWith('topic-a', { title: 'Updated' });
  });

  it('rejects stale content even when timestamps are identical', async () => {
    const revision = topicRevision(currentTopic());
    currentTopic().description = 'Another agent edited this';
    await expect(
      service.updateTopic('topic-a', { title: 'Stale' }, revision),
    ).rejects.toBeInstanceOf(TopicUpdateConflictError);
    expect(updateTopic).not.toHaveBeenCalled();
  });

  it('checks revisions inside the write queue, allowing only one concurrent editor', async () => {
    const revision = topicRevision(currentTopic());
    const results = await Promise.allSettled([
      service.updateTopic('topic-a', { title: 'First' }, revision),
      service.updateTopic(
        'topic-a',
        { description: 'Stale second edit' },
        revision,
      ),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: expect.any(TopicUpdateConflictError),
    });
    expect(updateTopic).toHaveBeenCalledTimes(1);
    expect(current).toMatchObject({
      title: 'First',
      description: 'Original brief',
    });
  });

  it('serializes conditional writes with UI updates', async () => {
    const revision = topicRevision(currentTopic());
    const results = await Promise.allSettled([
      service.updateTopic('topic-a', { title: 'UI edit' }),
      service.updateTopic('topic-a', { description: 'Agent edit' }, revision),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(updateTopic).toHaveBeenCalledTimes(1);
  });

  it('reports missing topics and keeps the queue usable after errors', async () => {
    const original = currentTopic();
    const revision = topicRevision(original);
    current = null;
    await expect(
      service.updateTopic('topic-a', { title: 'Missing' }, revision),
    ).rejects.toBeInstanceOf(TopicNotFoundError);
    current = original;
    updateTopic.mockRejectedValueOnce(new Error('Disk unavailable'));
    await expect(
      service.updateTopic('topic-a', { title: 'Failed' }, revision),
    ).rejects.toThrow('Disk unavailable');
    await expect(
      service.updateTopic('topic-a', { title: 'Recovered' }, revision),
    ).resolves.toMatchObject({ title: 'Recovered' });
  });
});

describe('TopicRegistryService references', () => {
  let service: TopicRegistryService;
  let createTopic: jest.Mock;
  let updateTopic: jest.Mock;

  beforeEach(() => {
    (homedir as jest.Mock).mockReturnValue('/unused');
    createTopic = jest.fn().mockResolvedValue({ id: 'topic-owner' });
    updateTopic = jest.fn().mockResolvedValue({ id: 'topic-owner' });
    (TopicStore as jest.Mock).mockImplementation(() => ({
      createTopic,
      updateTopic,
    }));
    (
      TopicRegistryService as unknown as {
        instance: TopicRegistryService | undefined;
      }
    ).instance = undefined;
    service = TopicRegistryService.getInstance();
  });

  it('forwards topic and C4 sketch references on create', async () => {
    const input = {
      title: 'Architecture',
      references: [
        { kind: 'topic' as const, topicId: 'topic-related' },
        { kind: 'c4-sketch' as const, sketchId: 'c4s-123-abc' },
      ],
    };

    await service.createTopic(input);

    expect(createTopic).toHaveBeenCalledWith(expect.objectContaining(input));
  });

  it('preserves omission and explicit empty references on create', async () => {
    await service.createTopic({ title: 'No attachments' });
    expect(createTopic.mock.calls[0][0]).not.toHaveProperty('references');

    await service.createTopic({ title: 'Empty attachments', references: [] });
    expect(createTopic.mock.calls[1][0]).toHaveProperty('references', []);
  });

  it('forwards reference replacements and clearing without changing description links', async () => {
    const references = [{ kind: 'topic' as const, topicId: 'topic-related' }];
    await service.updateTopic('topic-owner', { references });
    expect(updateTopic).toHaveBeenLastCalledWith('topic-owner', { references });

    await service.updateTopic('topic-owner', { references: [] });
    expect(updateTopic).toHaveBeenLastCalledWith('topic-owner', {
      references: [],
    });
  });
});
