/** @jest-environment node */
import type { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
import type { RepositoryRegistrationManager as RegistrationManager } from './RepositoryRegistrationManager';
import {
  selectStartupWatchRepositories,
  STARTUP_WATCH_LIMIT,
} from './RepositoryRegistrationManager';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

jest.mock('electron', () => ({
  app: { isReady: () => true, whenReady: () => Promise.resolve() },
}));

describe('desktop repository registration', () => {
  let registration: RegistrationManager;
  let manager: {
    registerRepository: jest.Mock;
    unregisterRepository: jest.Mock;
    releaseWatch: jest.Mock;
    acquireWatch: jest.Mock;
  };
  let repositories: { name: string; path: string; lastOpenedAt?: string }[];

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    manager = {
      registerRepository: jest.fn(async () => {}),
      unregisterRepository: jest.fn(async () => {}),
      releaseWatch: jest.fn(async () => {}),
      acquireWatch: jest.fn(async () => {}),
    };
    repositories = [
      { name: 'one', path: '/repos/one', lastOpenedAt: '2026-10-30T00:00:00Z' },
    ];
    const {
      RepositoryRegistrationManager,
    } = require('./RepositoryRegistrationManager');
    registration = RepositoryRegistrationManager.getInstance({
      monitoringManager: manager as unknown as RepositoryMonitoringManager,
      alexandriaRegistryService: { getRepositories: async () => repositories },
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('watches recently opened repositories once at startup', async () => {
    await registration.initialize();
    await registration.initialize();
    expect(manager.acquireWatch).toHaveBeenCalledTimes(1);
    expect(manager.acquireWatch).toHaveBeenCalledWith(
      '/repos/one',
      'RepositoryRegistrationManager',
    );
    expect(manager.registerRepository).not.toHaveBeenCalled();
    expect(registration.getStatus()).toEqual({
      isInitialized: true,
      registeredCount: 1,
      registeredPaths: ['/repos/one'],
    });
  });

  it('skips never-opened repositories at startup', async () => {
    repositories = [{ name: 'cold', path: '/repos/cold' }];
    await registration.initialize();
    expect(manager.acquireWatch).not.toHaveBeenCalled();
    expect(registration.getStatus().registeredCount).toBe(0);
  });

  it('deduplicates additions and unregisters removed repositories', async () => {
    await registration.handleRepositoryAdded(repositories[0]);
    await registration.handleRepositoryAdded(repositories[0]);
    expect(manager.registerRepository).toHaveBeenCalledTimes(1);
    await registration.handleRepositoryRemoved('/repos/one');
    expect(manager.releaseWatch).toHaveBeenCalledWith(
      '/repos/one',
      'RepositoryRegistrationManager',
    );
    expect(manager.unregisterRepository).toHaveBeenCalledWith('/repos/one');
    expect(registration.getStatus().registeredCount).toBe(0);
  });

  it('refreshes registration when the repository inventory changes', async () => {
    await registration.initialize();
    repositories = [{ name: 'two', path: '/repos/two' }];
    await registration.refreshAll();
    expect(manager.unregisterRepository).toHaveBeenCalledWith('/repos/one');
    expect(manager.registerRepository).toHaveBeenLastCalledWith('/repos/two');
    expect(registration.getStatus().registeredPaths).toEqual(['/repos/two']);
    // Only the startup pass acquires watches; refreshes register without watching.
    expect(manager.acquireWatch).toHaveBeenCalledTimes(1);
  });
});

describe('selectStartupWatchRepositories', () => {
  const entry = (path: string, lastOpenedAt?: string) =>
    ({ name: path, path, lastOpenedAt }) as unknown as AlexandriaEntry;

  it('returns the most recently opened repos first, capped at the limit', () => {
    const picked = selectStartupWatchRepositories(
      [
        entry('/a', '2026-01-01T00:00:00Z'),
        entry('/b', '2026-03-01T00:00:00Z'),
        entry('/c'),
        entry('/d', '2026-02-01T00:00:00Z'),
        entry('/e', 'not a date'),
      ],
      2,
    );
    expect(picked.map((r) => r.path)).toEqual(['/b', '/d']);
  });

  it('defaults to the startup limit', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      entry(`/r${i}`, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()),
    );
    expect(selectStartupWatchRepositories(many)).toHaveLength(
      STARTUP_WATCH_LIMIT,
    );
  });
});
