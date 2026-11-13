import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { SyncAllProvider, useSyncAll } from './SyncAllContext';
import { syncSingleRepository } from './syncSingleRepository';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

jest.mock('../../main-process-api/AlexandriaService', () => ({
  AlexandriaService: { getRepositories: jest.fn() },
}));
jest.mock('../../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: jest.fn(),
    onPreferencesUpdated: jest.fn(() => () => {}),
  },
}));
jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: { refreshRepository: jest.fn() },
}));
jest.mock('./syncSingleRepository', () => ({
  syncSingleRepository: jest.fn(),
}));

const mockedGetRepositories = jest.mocked(AlexandriaService.getRepositories);
const mockedGetPreferences = jest.mocked(UserPreferencesService.getPreferences);
const mockedSyncSingle = jest.mocked(syncSingleRepository);

function entry(path: string, name: string): AlexandriaEntry {
  return {
    path,
    name,
    github: { owner: 'octocat', name },
  } as unknown as AlexandriaEntry;
}

function Probe() {
  const { isSyncing, autoSync } = useSyncAll();
  return (
    <div
      data-testid="probe"
      data-syncing={isSyncing ? 'yes' : 'no'}
      data-enabled={autoSync.enabled ? 'yes' : 'no'}
      data-interval={autoSync.intervalMinutes}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockedGetPreferences.mockResolvedValue({});
  mockedGetRepositories.mockResolvedValue([]);
  mockedSyncSingle.mockResolvedValue({
    path: '/repos/octocat/hello',
    status: 'up-to-date',
  });
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderProvider() {
  await act(async () => {
    render(
      <SyncAllProvider>
        <Probe />
      </SyncAllProvider>,
    );
  });
}

test('loads the persisted auto-sync setting', async () => {
  mockedGetPreferences.mockResolvedValue({
    repositoryAutoSync: { enabled: true, intervalMinutes: 60 },
  });
  await renderProvider();
  const probe = await screen.findByTestId('probe');
  expect(probe.dataset.enabled).toBe('yes');
  expect(probe.dataset.interval).toBe('60');
});

test('a scheduled tick syncs the registered clones', async () => {
  mockedGetPreferences.mockResolvedValue({
    repositoryAutoSync: { enabled: true, intervalMinutes: 30 },
  });
  mockedGetRepositories.mockResolvedValue([
    entry('/repos/octocat/hello', 'hello'),
  ]);
  await renderProvider();

  expect(mockedGetRepositories).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30 * 60_000 + 5_000);
  });

  expect(mockedGetRepositories).toHaveBeenCalledTimes(1);
  expect(mockedSyncSingle).toHaveBeenCalledWith('/repos/octocat/hello');
});

test('no timer runs while auto-sync is disabled', async () => {
  await renderProvider();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(4 * 60 * 60_000);
  });
  expect(mockedGetRepositories).not.toHaveBeenCalled();
  expect(mockedSyncSingle).not.toHaveBeenCalled();
});
