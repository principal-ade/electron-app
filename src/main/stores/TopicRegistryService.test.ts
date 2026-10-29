/// <reference types="jest" />
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { homedir } from 'os';
import { join } from 'node:path';
import { TopicStore } from '@principal-ai/subsystems-core/node';
import { TopicRegistryService } from './TopicRegistryService';

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
