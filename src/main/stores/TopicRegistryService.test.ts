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
