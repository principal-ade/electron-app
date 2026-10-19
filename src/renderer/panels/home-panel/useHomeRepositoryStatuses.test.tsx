import { act, renderHook } from '@testing-library/react';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { useHomeRepositoryStatuses } from './useHomeRepositoryStatuses';

jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    setHomeRefreshInterest: jest.fn(),
    onGitStatusChanged: jest.fn(),
  },
}));
const service = jest.mocked(RepositoryMonitoringService);
const status = (ahead: number): GitStatusWithFiles => ({
  repoPath: '/repo',
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

describe('useHomeRepositoryStatuses', () => {
  let emit: (status: GitStatusWithFiles) => void;
  let off: jest.Mock;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    off = jest.fn();
    service.onGitStatusChanged.mockImplementation((callback) => {
      emit = callback;
      return off;
    });
    service.setHomeRefreshInterest.mockResolvedValue([]);
  });

  it('registers deduplicated paths and releases interest on unmount', async () => {
    service.setHomeRefreshInterest.mockResolvedValue([status(1)]);
    const { result, unmount } = renderHook(() =>
      useHomeRepositoryStatuses(['/repo', '/repo', '/clean']),
    );
    await act(async () => {});
    expect(service.setHomeRefreshInterest).toHaveBeenCalledWith({
      consumerId: expect.any(String),
      repoPaths: ['/clean', '/repo'],
      visible: true,
    });
    expect(result.current.get('/repo')?.ahead).toBe(1);
    unmount();
    expect(off).toHaveBeenCalled();
    expect(service.setHomeRefreshInterest).toHaveBeenLastCalledWith({
      consumerId: expect.any(String),
      repoPaths: [],
      visible: false,
    });
  });

  it('updates visibility and rechecks interest on focus without renderer polling', async () => {
    const { unmount } = renderHook(() => useHomeRepositoryStatuses(['/repo']));
    await act(async () => {});
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(service.setHomeRefreshInterest.mock.calls.at(-1)?.[0].visible).toBe(
      false,
    );
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      window.dispatchEvent(new Event('focus'));
    });
    expect(service.setHomeRefreshInterest.mock.calls.at(-1)?.[0].visible).toBe(
      true,
    );
    unmount();
  });

  it('keeps live updates newer than an in-flight snapshot', async () => {
    let resolve!: (value: GitStatusWithFiles[]) => void;
    service.setHomeRefreshInterest.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, unmount } = renderHook(() =>
      useHomeRepositoryStatuses(['/repo']),
    );
    act(() => emit(status(2)));
    await act(async () => resolve([status(1)]));
    expect(result.current.get('/repo')?.ahead).toBe(2);
    unmount();
  });

  it('ignores unrelated status and does not reconnect for equivalent path lists', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ paths }) => useHomeRepositoryStatuses(paths),
      { initialProps: { paths: ['/repo'] } },
    );
    await act(async () => {});
    act(() => emit({ ...status(2), repoPath: '/other' }));
    expect(result.current.size).toBe(0);
    rerender({ paths: ['/repo', '/repo'] });
    expect(service.setHomeRefreshInterest).toHaveBeenCalledTimes(1);
    unmount();
  });
});
