import { act, renderHook } from '@testing-library/react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { useRepositoryStatuses } from './useRepositoryStatuses';

jest.mock('../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getGitStatusWithFiles: jest.fn(),
    refreshGitStatus: jest.fn(),
    onGitStatusChanged: jest.fn(),
    acquireWatch: jest.fn(),
    releaseWatch: jest.fn(),
  },
}));
const service = jest.mocked(RepositoryMonitoringService);
const status = (repoPath = '/repo', ahead = 0): GitStatusWithFiles => ({
  repoPath,
  ahead,
  behind: 0,
  branch: 'main',
  isDirty: false,
  hasStaged: false,
  hasUntracked: false,
  watchingEnabled: false,
  modifiedFiles: [],
  stagedFiles: [],
  createdFiles: [],
  deletedFiles: [],
  untrackedFiles: [],
  hash: String(ahead),
});
let emit: (value: GitStatusWithFiles) => void;
let off: jest.Mock;
beforeEach(() => {
  jest.resetAllMocks();
  service.acquireWatch.mockResolvedValue({ success: true });
  service.releaseWatch.mockResolvedValue({ success: true });
  off = jest.fn();
  service.onGitStatusChanged.mockImplementation((callback) => {
    emit = callback;
    return off;
  });
  service.getGitStatusWithFiles.mockImplementation(async (path) =>
    status(path),
  );
  service.refreshGitStatus.mockImplementation(async (path) => status(path, 2));
});

it('reads each clone once and shares branch and file status without reconnecting for equivalent paths', async () => {
  const { result, rerender, unmount } = renderHook(
    ({ paths }) => useRepositoryStatuses(paths),
    { initialProps: { paths: ['/repo', '/other', '/repo'] } },
  );
  await act(async () => {});
  expect(service.getGitStatusWithFiles).toHaveBeenCalledTimes(2);
  expect(service.acquireWatch).toHaveBeenCalledTimes(2);
  expect(result.current.statuses.size).toBe(2);
  expect(result.current.loading).toBe(false);
  rerender({ paths: ['/other', '/repo'] });
  expect(service.onGitStatusChanged).toHaveBeenCalledTimes(1);
  act(() => emit(status('/repo', 3)));
  expect(result.current.statuses.get('/repo')?.ahead).toBe(3);
  act(() => emit(status('/unrelated', 9)));
  expect(result.current.statuses.has('/unrelated')).toBe(false);
  unmount();
  await act(async () => {});
  expect(service.releaseWatch.mock.calls).toEqual(
    service.acquireWatch.mock.calls,
  );
  expect(off).toHaveBeenCalled();
});

it('releases pending watch acquisitions after unmount without releasing another consumer', async () => {
  let resolve!: (value: { success: boolean }) => void;
  service.acquireWatch.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = renderHook(() => useRepositoryStatuses(['/repo']));
  first.unmount();
  expect(service.releaseWatch).not.toHaveBeenCalled();
  const second = renderHook(() => useRepositoryStatuses(['/repo']));
  await act(async () => {
    resolve({ success: true });
  });
  const [firstRef, secondRef] = service.acquireWatch.mock.calls.map(
    (call) => call[1],
  );
  expect(firstRef).not.toBe(secondRef);
  expect(service.releaseWatch).toHaveBeenCalledWith('/repo', firstRef);
  expect(service.releaseWatch).not.toHaveBeenCalledWith('/repo', secondRef);
  second.unmount();
  await act(async () => {});
  expect(service.releaseWatch).toHaveBeenCalledWith('/repo', secondRef);
});

it('preserves live updates when an older initial snapshot finishes', async () => {
  let resolve!: (value: GitStatusWithFiles) => void;
  service.getGitStatusWithFiles.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = renderHook(() => useRepositoryStatuses(['/repo']));
  act(() => emit(status('/repo', 4)));
  await act(async () => resolve(status('/repo', 1)));
  expect(result.current.statuses.get('/repo')?.ahead).toBe(4);
});

it('refreshes through repository-monitor without overwriting newer live updates', async () => {
  const { result } = renderHook(() => useRepositoryStatuses(['/repo']));
  await act(async () => {});
  await act(async () => result.current.refresh('/repo'));
  expect(service.refreshGitStatus).toHaveBeenCalledWith('/repo');
  expect(result.current.statuses.get('/repo')?.ahead).toBe(2);
  let resolve!: (value: GitStatusWithFiles) => void;
  service.refreshGitStatus.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let refreshing!: Promise<void>;
  act(() => {
    refreshing = result.current.refresh('/repo');
  });
  act(() => emit(status('/repo', 5)));
  await act(async () => {
    resolve(status('/repo', 1));
    await refreshing;
  });
  expect(result.current.statuses.get('/repo')?.ahead).toBe(5);
});

it('does not turn missing or mismatched monitor status into a clean branch', async () => {
  service.getGitStatusWithFiles
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(status('/wrong'));
  const { result } = renderHook(() =>
    useRepositoryStatuses(['/repo', '/second']),
  );
  await act(async () => {});
  expect(result.current.statuses.size).toBe(0);
  expect(result.current.loading).toBe(false);
});

it('clears old clones and ignores their in-flight snapshots and refreshes', async () => {
  let resolve!: (value: GitStatusWithFiles) => void;
  service.refreshGitStatus.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result, rerender } = renderHook(
    ({ path }) => useRepositoryStatuses([path]),
    {
      initialProps: { path: '/repo' },
    },
  );
  await act(async () => {});
  let refreshing!: Promise<void>;
  act(() => {
    refreshing = result.current.refresh('/repo');
  });
  rerender({ path: '/next' });
  await act(async () => {
    resolve(status('/repo', 8));
    await refreshing;
  });
  expect(result.current.statuses.has('/repo')).toBe(false);
  expect(result.current.statuses.has('/next')).toBe(true);
  expect(off).toHaveBeenCalled();
});
