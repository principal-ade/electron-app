/** @jest-environment node */
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { HomeRepositoryRefreshScheduler } from './HomeRepositoryRefreshScheduler';

function status(repoPath: string, ahead = 0): GitStatusWithFiles {
  return {
    repoPath,
    ahead,
    behind: 0,
    branch: 'main',
    isDirty: false,
    hasStaged: false,
    hasUntracked: false,
    watchingEnabled: false,
    modifiedFiles: [],
    untrackedFiles: [],
    stagedFiles: [],
    createdFiles: [],
    deletedFiles: [],
    hash: `${repoPath}:${ahead}`,
  };
}

describe('HomeRepositoryRefreshScheduler', () => {
  let refresh: jest.Mock<Promise<GitStatusWithFiles>, [string]>;
  let publish: jest.Mock;
  let onError: jest.Mock;
  let scheduler: HomeRepositoryRefreshScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    refresh = jest.fn(async (path) => status(path));
    publish = jest.fn();
    onError = jest.fn();
    scheduler = new HomeRepositoryRefreshScheduler(refresh, publish, onError);
  });
  afterEach(() => {
    scheduler.dispose();
    jest.useRealTimers();
  });

  it('spreads first checks and repeat checks evenly across a minute', async () => {
    scheduler.setConsumer('home', ['/a', '/b', '/c'], true);
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh.mock.calls).toEqual([['/a']]);
    await jest.advanceTimersByTimeAsync(19_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b']]);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b'], ['/c']]);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b'], ['/c'], ['/a']]);
    expect(publish).toHaveBeenCalledTimes(4);
  });

  it('deduplicates overlapping interests from multiple windows', async () => {
    scheduler.setConsumer('one', ['/a', '/b', '/b'], true);
    scheduler.setConsumer('two', ['/a', '/b'], true);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b']]);
    scheduler.removeConsumer('one');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b'], ['/a']]);
  });

  it('defers a repository recently refreshed by a watcher event', async () => {
    scheduler.setConsumer('home', ['/a', '/b'], true);
    scheduler.observeStatus(status('/a', 2));
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh.mock.calls).toEqual([['/b']]);
    expect(scheduler.getStatuses(['/a'])[0].ahead).toBe(2);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh.mock.calls).toEqual([['/b'], ['/a']]);
  });

  it('pauses when hidden and resumes overdue checks without a catch-up burst', async () => {
    scheduler.setConsumer('home', ['/a', '/b', '/c'], false);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).not.toHaveBeenCalled();
    scheduler.setConsumer('home', ['/a', '/b', '/c'], true);
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(19_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.setConsumer('home', ['/a', '/b', '/c'], false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains freshness across Home unmounts and remounts', async () => {
    scheduler.setConsumer('old', ['/a'], true);
    await jest.advanceTimersByTimeAsync(0);
    scheduler.removeConsumer('old');
    await jest.advanceTimersByTimeAsync(10_000);
    scheduler.setConsumer('new', ['/a'], true);
    expect(scheduler.getStatuses(['/a'])).toEqual([status('/a')]);
    await jest.advanceTimersByTimeAsync(49_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('caps slow checks at two and never overlaps a repository', async () => {
    const pending: Array<() => void> = [];
    refresh.mockImplementation(
      (path) =>
        new Promise((resolve) => {
          pending.push(() => resolve(status(path)));
        }),
    );
    scheduler.setConsumer('home', ['/a', '/b', '/c'], true);
    await jest.advanceTimersByTimeAsync(180_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b']]);
    pending.shift()?.();
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b'], ['/c']]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('backs off failures for a minute without stopping other repositories', async () => {
    refresh.mockRejectedValueOnce(new Error('missing clone'));
    scheduler.setConsumer('home', ['/a', '/b'], true);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(onError).toHaveBeenCalledWith('/a', expect.any(Error));
    expect(refresh.mock.calls).toEqual([['/a'], ['/b']]);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh.mock.calls).toEqual([['/a'], ['/b'], ['/a']]);
  });

  it('does not overwrite a newer live event with an older read result', async () => {
    let resolve!: (value: GitStatusWithFiles) => void;
    refresh.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    scheduler.setConsumer('home', ['/a'], true);
    await jest.advanceTimersByTimeAsync(0);
    scheduler.observeStatus(status('/a', 3));
    resolve(status('/a', 1));
    await jest.advanceTimersByTimeAsync(0);
    expect(scheduler.getStatuses(['/a'])[0].ahead).toBe(3);
    expect(publish).not.toHaveBeenCalled();
  });

  it('pauses during sleep and resumes gradually after waking', async () => {
    scheduler.setConsumer('home', ['/a', '/b'], true);
    scheduler.setSuspended(true);
    await jest.advanceTimersByTimeAsync(300_000);
    expect(refresh).not.toHaveBeenCalled();
    scheduler.setSuspended(false);
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling on disposal, including completion of in-flight work', async () => {
    let resolve!: (value: GitStatusWithFiles) => void;
    refresh.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    scheduler.setConsumer('home', ['/a', '/b'], true);
    await jest.advanceTimersByTimeAsync(0);
    scheduler.dispose();
    resolve(status('/a'));
    await jest.advanceTimersByTimeAsync(120_000);
    expect(publish).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
