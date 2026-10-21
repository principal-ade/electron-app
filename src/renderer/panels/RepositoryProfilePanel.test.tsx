import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import {
  RepositoryProfilePanel,
  type RepositoryProfileData,
  type RepositoryProfilePanelActions,
  type RepositoryProfilePanelContext,
} from './RepositoryProfilePanel';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { GitService } from '../main-process-api/GitService';

jest.mock('@principal-ade/industry-theme', () => {
  const theme = { colors: {}, fonts: {}, fontSizes: [10, 12, 14, 16, 18], radii: [2, 4, 8] };
  return { useTheme: () => ({ theme }) };
});
jest.mock('@principal-ai/file-city-react', () => ({
  ArchitectureMapHighlightLayers: () => null,
  createFileColorHighlightLayers: () => [],
}));
jest.mock('../dev-workspace/file-city-panel/cityDataBuilders', () => ({}));
jest.mock('themed-markdown', () => ({ DocumentView: () => <div>Remote README</div> }));
jest.mock('../events/repositorySelected', () => ({ payloadFromGithub: jest.fn() }));
jest.mock('../providers/AuthProvider', () => ({ useAuthUser: () => ({ user: null }) }));
jest.mock('../main-process-api/GitService', () => ({
  GitService: { getBranchStatus: jest.fn(), getOwnershipMap: jest.fn(), getContributors: jest.fn() },
}));
jest.mock('../main-process-api/GithubService', () => ({ GithubService: {} }));
jest.mock('../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: { getGitStatusWithFiles: jest.fn(), onGitStatusChanged: jest.fn() },
}));
jest.mock('../components/GitCloneModal', () => ({ GitCloneModal: () => null }));
jest.mock('./components/ForkModal', () => ({ ForkModal: () => null }));
jest.mock('./components/RepositoryPackageList', () => ({
  RepositoryPackageList: ({ repositoryPath }: { repositoryPath: string }) => <div>Packages for {repositoryPath}</div>,
}));

const repository: RepositoryProfileData = {
  name: 'repo',
  fullName: 'org/repo',
  owner: 'org',
  stars: 0, forks: 0, watchers: 0, openIssues: 0, size: 0,
  activityData: new Map(),
  defaultBranch: 'main',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  isLocal: true,
  localClones: [{ path: '/repo', addedAt: 1 }],
};
const actions = {
  getLocalFileTree: jest.fn().mockResolvedValue(null),
  getRemoteFileTree: jest.fn().mockResolvedValue(null),
  getLineCounts: jest.fn().mockResolvedValue({}),
} as unknown as RepositoryProfilePanelActions;
const events = { emit: jest.fn() } as unknown as PanelEventEmitter;
const context = (data = repository) => ({
  currentScope: { type: 'repository', repository: data },
}) as unknown as RepositoryProfilePanelContext;
let statusChanged: Parameters<typeof RepositoryMonitoringService.onGitStatusChanged>[0];
const dirtyStatus = {
  repoPath: '/repo', isDirty: true,
  modifiedFiles: ['src/changed.ts'],
  stagedFiles: [], untrackedFiles: [], deletedFiles: [],
} as unknown as GitStatusWithFiles;

beforeEach(() => {
  jest.clearAllMocks();
  window.ResizeObserver = jest.fn().mockImplementation(() => ({ observe: jest.fn(), disconnect: jest.fn() }));
  jest.mocked(GitService.getBranchStatus).mockResolvedValue({
    ahead: 0, behind: 0, hasUpstream: false, branch: 'main',
  });
  jest.mocked(GitService.getContributors).mockResolvedValue([]);
  jest.mocked(GitService.getOwnershipMap).mockResolvedValue({
    byEmail: new Map(), totalLines: new Map(), totalLinesGlobal: 0,
  });
  jest.mocked(RepositoryMonitoringService.getGitStatusWithFiles).mockResolvedValue(dirtyStatus);
  jest.mocked(RepositoryMonitoringService.onGitStatusChanged).mockImplementation((handler) => {
    statusChanged = handler;
    return jest.fn();
  });
});

test('defaults to changed files when dirty and switches both ways to package stats', async () => {
  render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  expect(await screen.findByRole('button', { name: /src\/changed\.ts/ })).toBeTruthy();
  expect(screen.queryByText('Packages for /repo')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Changed Files' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Repository Info' }));
  expect(screen.getByText('Packages for /repo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Repository Info' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Changed Files' }));
  expect(screen.getByRole('button', { name: 'Repository Info' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /src\/changed\.ts/ })).toBeTruthy();
});

test('shows packages without a switch after the working tree becomes clean', async () => {
  render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  await screen.findByRole('button', { name: /src\/changed\.ts/ });
  act(() => statusChanged({ ...dirtyStatus, isDirty: false, modifiedFiles: [] }));
  expect(screen.getByText('Packages for /repo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Changed Files' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Repository Info' })).toBeNull();
});

test('resets the switch when changing repositories', async () => {
  const { rerender } = render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  await screen.findByRole('button', { name: /src\/changed\.ts/ });
  fireEvent.click(screen.getByRole('button', { name: 'Repository Info' }));
  const other = { ...repository, fullName: 'org/other', localClones: [{ path: '/other', addedAt: 2 }] };
  rerender(<RepositoryProfilePanel context={context(other)} actions={actions} events={events} />);
  await screen.findByRole('button', { name: /src\/changed\.ts/ });
  expect(screen.queryByText('Packages for /other')).toBeNull();
  expect(screen.getByRole('button', { name: 'Repository Info' })).toBeTruthy();
});
