import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ArchitectureMapHighlightLayers, createFileColorHighlightLayers } from '@principal-ai/file-city-react';
import { buildCityDataFromFileTree, enrichWithLineCounts, type CityData } from '../dev-workspace/file-city-panel/cityDataBuilders';
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
  ArchitectureMapHighlightLayers: jest.fn(() => null),
  createFileColorHighlightLayers: jest.fn(() => []),
}));
jest.mock('../dev-workspace/file-city-panel/cityDataBuilders', () => ({
  buildCityDataFromFileTree: jest.fn(),
  enrichWithLineCounts: jest.fn(),
}));
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
  RepositoryPackageList: ({ repositoryPath, onPackageHover }: { repositoryPath: string; onPackageHover?: (path: string | null) => void }) => (
    <div>
      Packages for {repositoryPath}
      <button onMouseEnter={() => onPackageHover?.('packages/ui')} onMouseLeave={() => onPackageHover?.(null)}>Hover UI package</button>
      <button onMouseEnter={() => onPackageHover?.('')}>Hover root package</button>
    </div>
  ),
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
  jest.mocked(createFileColorHighlightLayers).mockReturnValue([]);
  jest.mocked(actions.getLocalFileTree).mockResolvedValue(null);
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

test('spotlights only package files without zooming and restores existing layers on leave', async () => {
  const paths = ['packages/ui/index.ts', 'packages/ui/nested/button.ts', 'packages/ui-other/index.ts', 'package.json', 'src/changed.ts'];
  const city = { buildings: paths.map(path => ({ path })) } as CityData;
  jest.mocked(actions.getLocalFileTree).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof actions.getLocalFileTree>>>);
  jest.mocked(buildCityDataFromFileTree).mockReturnValue(city);
  jest.mocked(enrichWithLineCounts).mockReturnValue(city);
  jest.mocked(createFileColorHighlightLayers).mockReturnValue([{
    id: 'suffix', name: 'File colors', enabled: true, color: '#abc', priority: 100,
    items: paths.map(path => ({ type: 'file', path, renderStrategy: 'fill' })),
  }]);
  const { rerender } = render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  await screen.findByRole('button', { name: /src\/changed\.ts/ });
  fireEvent.click(screen.getByRole('button', { name: 'Repository Info' }));
  const mapProps = () => jest.mocked(ArchitectureMapHighlightLayers).mock.calls.slice(-1)[0][0];
  await waitFor(() => expect(mapProps().highlightLayers?.some(layer => layer.id === 'suffix')).toBe(true));
  const normalLayers = mapProps().highlightLayers;

  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover UI package' }));
  expect(mapProps().isolationMode).toBe('transparent');
  expect(mapProps().dimOpacity).toBe(0.15);
  expect(mapProps().fileColorLayers).toEqual([]);
  expect(mapProps().focusDirectory).toBeUndefined();
  expect(mapProps().highlightLayers?.find(layer => layer.id === 'suffix')?.items.map(item => item.path)).toEqual(paths.slice(0, 2));
  expect(mapProps().highlightLayers?.flatMap(layer => layer.items).every(item => item.renderStrategy === 'fill')).toBe(true);
  expect(mapProps().highlightLayers?.flatMap(layer => layer.items).every(item => paths.slice(0, 2).includes(item.path))).toBe(true);

  fireEvent.mouseLeave(screen.getByRole('button', { name: 'Hover UI package' }));
  expect(mapProps().highlightLayers).toBe(normalLayers);
  expect(mapProps().isolationMode).toBeUndefined();
  expect(mapProps().fileColorLayers).toBeUndefined();

  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Hover root package' }));
  expect(mapProps().highlightLayers?.find(layer => layer.id === 'suffix')?.items.map(item => item.path)).toEqual(paths);
  expect(mapProps().highlightLayers?.find(layer => layer.id === 'git-modified')?.items).toEqual([
    { type: 'file', path: 'src/changed.ts', renderStrategy: 'border' },
  ]);
  rerender(<RepositoryProfilePanel context={context({ ...repository, fullName: 'org/other' })} actions={actions} events={events} />);
  expect(mapProps().isolationMode).toBe('transparent');
  expect(mapProps().dimOpacity).toBe(0.55);
});

test('defaults to changed files when dirty and switches both ways to package stats', async () => {
  render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  const changedFile = await screen.findByRole('button', { name: /src\/changed\.ts/ });
  expect(changedFile.style.paddingTop).toBe('8px');
  expect(changedFile.style.paddingBottom).toBe('8px');
  expect(changedFile.style.paddingLeft).toBe('4px');
  expect(changedFile.parentElement?.style.gap).toBe('0');
  expect(screen.queryByText('Packages for /repo')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Changed Files' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Repository Info' }));
  expect(screen.getByText('Packages for /repo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Repository Info' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Changed Files' }));
  expect(screen.getByRole('button', { name: 'Repository Info' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /src\/changed\.ts/ })).toBeTruthy();
});

test('subtly dims files without git borders only while the changed-file list is visible', async () => {
  const paths = ['src/changed.ts', 'src/staged.ts', 'src/new.ts', 'src/unchanged.ts'];
  const city = { buildings: paths.map(path => ({ path })) } as CityData;
  jest.mocked(actions.getLocalFileTree).mockResolvedValue({} as NonNullable<Awaited<ReturnType<typeof actions.getLocalFileTree>>>);
  jest.mocked(buildCityDataFromFileTree).mockReturnValue(city);
  jest.mocked(enrichWithLineCounts).mockReturnValue(city);
  jest.mocked(createFileColorHighlightLayers).mockImplementation(buildings => [{
    id: 'suffix', name: 'File colors', enabled: true, color: '#abc', priority: 100, opacity: 1,
    items: (buildings ?? []).map(building => ({ type: 'file', path: building.path, renderStrategy: 'fill' })),
  }]);
  render(<RepositoryProfilePanel context={context()} actions={actions} events={events} />);
  await screen.findByRole('button', { name: /src\/changed\.ts/ });
  const mapProps = () => jest.mocked(ArchitectureMapHighlightLayers).mock.calls.slice(-1)[0][0];
  await waitFor(() => expect(mapProps().highlightLayers?.find(layer => layer.id === 'git-modified')).toBeTruthy());
  expect(mapProps().isolationMode).toBe('transparent');
  expect(mapProps().dimOpacity).toBe(0.55);
  expect(mapProps().fileColorLayers).toEqual([]);
  expect(mapProps().focusDirectory).toBeUndefined();
  expect(mapProps().highlightLayers?.find(layer => layer.id === 'suffix')).toMatchObject({
    opacity: 1,
    items: [{ type: 'file', path: 'src/changed.ts', renderStrategy: 'fill' }],
  });

  act(() => statusChanged({
    ...dirtyStatus,
    stagedFiles: ['src/staged.ts'], untrackedFiles: ['src/new.ts'], deletedFiles: ['src/deleted.ts'],
  }));
  expect(mapProps().highlightLayers?.filter(layer => layer.id.startsWith('git-')).map(layer => layer.id)).toEqual([
    'git-staged', 'git-modified', 'git-untracked', 'git-deleted',
  ]);
  expect(mapProps().highlightLayers?.find(layer => layer.id === 'suffix')?.items.map(item => item.path)).toEqual(paths.slice(0, 3));

  fireEvent.click(screen.getByRole('button', { name: 'Repository Info' }));
  expect(mapProps().isolationMode).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Changed Files' }));
  expect(mapProps().isolationMode).toBe('transparent');
  expect(mapProps().dimOpacity).toBe(0.55);
  act(() => statusChanged({ ...dirtyStatus, isDirty: false, modifiedFiles: [] }));
  expect(mapProps().isolationMode).toBeUndefined();
  expect(mapProps().fileColorLayers).toBeUndefined();
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
