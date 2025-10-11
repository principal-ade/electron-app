import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { RepositoryCacheRegistry } from './RepositoryCacheRegistry';
import type { CacheEntry, CacheSliceDataMap } from '../types';

const repoPath = '/test/repo';

function createGitStatus(version?: number): CacheSliceDataMap['gitStatus'] {
  return {
    repoPath,
    branch: 'main',
    isDirty: false,
    hasUntracked: false,
    hasStaged: false,
    ahead: version ?? 0,
    behind: 0,
    watchingEnabled: true,
    modifiedFiles: [],
    untrackedFiles: [],
    stagedFiles: [],
    createdFiles: [],
    deletedFiles: [],
  };
}

describe('RepositoryCacheRegistry', () => {
  let registry: RepositoryCacheRegistry;
  let currentTime = 1000;

  const tick = (by = 1) => {
    currentTime += by;
  };

  beforeEach(() => {
    currentTime = 1000;
    registry = new RepositoryCacheRegistry({
      concurrency: 1,
      hash: (payload) => JSON.stringify(payload),
      now: () => currentTime,
    });
  });

  it('builds data once and serves cached entries afterwards', async () => {
    const builder = jest
      .fn<() => Promise<CacheSliceDataMap['gitStatus']>>()
      .mockResolvedValue(createGitStatus());

    const first = await registry.getOrBuild(repoPath, 'gitStatus', builder);
    tick();
    const second = await registry.getOrBuild(repoPath, 'gitStatus', builder);

    expect(builder).toHaveBeenCalledTimes(1);
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(second.timestamp).toBe(first.timestamp);
  });

  it('deduplicates concurrent rebuilds and emits cacheUpdated once', async () => {
    const builder = jest
      .fn<() => Promise<CacheSliceDataMap['gitStatus']>>()
      .mockImplementation(async () => {
        tick(5);
        return createGitStatus(5);
      });
    const listener = jest.fn();
    registry.on('cacheUpdated', listener);

    const [first, second] = await Promise.all([
      registry.scheduleRebuild(repoPath, 'gitStatus', builder),
      registry.scheduleRebuild(repoPath, 'gitStatus', builder),
    ]);

    expect(builder).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(first.hash).toBe(JSON.stringify(createGitStatus(5)));
  });

  it('records errors when rebuild fails', async () => {
    const error = new Error('builder failed');
    const builder = jest
      .fn<() => Promise<CacheSliceDataMap['gitStatus']>>()
      .mockRejectedValue(error);

    await expect(
      registry.scheduleRebuild(repoPath, 'gitStatus', builder),
    ).rejects.toThrow('builder failed');

    const entry = registry.get(repoPath, 'gitStatus') as CacheEntry<
      CacheSliceDataMap['gitStatus']
    >;
    expect(entry.version).toBe(1);
    expect(entry.error).toEqual(
      expect.objectContaining({
        message: 'builder failed',
        name: 'Error',
      }),
    );
    expect(entry.data).toBeUndefined();
  });

  it('invalidates entries and increments version', async () => {
    const builder = jest
      .fn<() => Promise<CacheSliceDataMap['gitStatus']>>()
      .mockResolvedValue(createGitStatus());
    const built = await registry.getOrBuild(repoPath, 'gitStatus', builder);
    expect(built.version).toBe(1);

    const invalidated = registry.invalidate(repoPath, 'gitStatus');
    expect(invalidated.version).toBe(2);
    expect(invalidated.data).toBeUndefined();
    expect(invalidated.hash).toBeUndefined();
  });
});
