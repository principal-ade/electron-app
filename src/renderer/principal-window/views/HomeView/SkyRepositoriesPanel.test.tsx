import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useHomeRepositoryStatuses } from '../../../panels/home-panel/useHomeRepositoryStatuses';
import { SkyRepositoriesPanel } from './SkyRepositoriesPanel';
import { useGithubOrganizations } from '../../../hooks/useGithubGraph';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#eee',
        textSecondary: '#aaa',
        primary: '#58f',
        backgroundSecondary: '#222',
        border: '#444',
        warning: '#fa0',
        success: '#00aa00',
      },
      fonts: { body: 'sans-serif' },
      fontSizes: [12, 14],
    },
  }),
}));
jest.mock('../../../panels/InProgressActivityPanel', () => ({
  InProgressActivityPanel: () => <div data-testid="cities">City cards</div>,
}));
jest.mock('../../../panels/home-panel/useHomeRepositoryStatuses', () => ({
  useHomeRepositoryStatuses: jest.fn(),
}));
jest.mock('../../../providers/AuthProvider', () => ({
  useAuthUser: () => ({
    user: { login: 'me', avatarUrl: 'https://avatars.example/me.png' },
    profile: { name: 'My Account' },
  }),
}));
jest.mock('../../../hooks/useGithubGraph', () => ({
  useGithubOrganizations: jest.fn(() => ({ orgs: [], loading: false })),
}));
const statuses = jest.mocked(useHomeRepositoryStatuses);

function entry(
  name: string,
  extra: Partial<AlexandriaEntry> = {},
): AlexandriaEntry {
  return {
    name,
    path: `/work/${name}`,
    remoteUrl: `https://github.com/acme/${name}.git`,
    ...extra,
  } as AlexandriaEntry;
}
function status(
  repoPath: string,
  extra: Partial<GitStatusWithFiles> = {},
): GitStatusWithFiles {
  return {
    repoPath,
    branch: 'main',
    isDirty: false,
    ahead: 0,
    behind: 0,
    hasStaged: false,
    hasUntracked: false,
    watchingEnabled: false,
    modifiedFiles: [],
    untrackedFiles: [],
    stagedFiles: [],
    createdFiles: [],
    deletedFiles: [],
    hash: 'status',
    ...extra,
  };
}
const actions = {
  getFileTreeForLocalRepo: jest.fn(),
  getWorkingChanges: jest.fn(),
  getAheadCommits: jest.fn(),
  getBehindCommits: jest.fn(),
  pushBranch: jest.fn(),
};
const emit = jest.fn();
const events = { emit } as unknown as PanelEventEmitter;
function panel(repositories: AlexandriaEntry[]) {
  return (
    <SkyRepositoriesPanel
      repositories={repositories}
      events={events}
      actions={actions}
    />
  );
}
function showAll() {
  fireEvent.click(screen.getByRole('button', { name: 'All' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.removeItem('principal:skyRepositoryFilter');
  statuses.mockReturnValue(new Map());
  jest
    .mocked(useGithubOrganizations)
    .mockReturnValue({ orgs: [], loading: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('reopens All after the panel is closed and mounted again', () => {
  const { unmount } = render(panel([entry('app')]));
  showAll();
  expect(localStorage.getItem('principal:skyRepositoryFilter')).toBe('all');
  unmount();
  render(panel([entry('app')]));
  expect(
    screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryByTestId('cities')).toBeNull();
});

test('remembers switching back to In Progress', () => {
  localStorage.setItem('principal:skyRepositoryFilter', 'all');
  const { unmount } = render(panel([entry('app')]));
  fireEvent.click(screen.getByRole('button', { name: 'In Progress' }));
  expect(localStorage.getItem('principal:skyRepositoryFilter')).toBe(
    'in-progress',
  );
  unmount();
  render(panel([entry('app')]));
  expect(screen.queryByTestId('cities')).not.toBeNull();
  expect(
    screen
      .getByRole('button', { name: 'In Progress' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('falls back to In Progress for an invalid stored filter', () => {
  localStorage.setItem('principal:skyRepositoryFilter', 'invalid');
  render(panel([entry('app')]));
  expect(screen.queryByTestId('cities')).not.toBeNull();
});

test('still allows toggling when reading or writing storage fails', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  render(panel([entry('app')]));
  expect(screen.queryByTestId('cities')).not.toBeNull();
  showAll();
  expect(
    screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'In Progress' }));
  expect(screen.queryByTestId('cities')).not.toBeNull();
});

test('defaults to city-based In Progress and toggles back from All', () => {
  render(panel([entry('app')]));
  expect(
    screen
      .getByRole('button', { name: 'In Progress' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryByTestId('cities')).not.toBeNull();
  expect(statuses).not.toHaveBeenCalled();
  showAll();
  expect(
    screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryByTestId('cities')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'In Progress' }));
  expect(screen.queryByTestId('cities')).not.toBeNull();
});

test('All shows clean and dirty repositories in two columns without city data', () => {
  statuses.mockReturnValue(
    new Map([
      ['/work/clean', status('/work/clean')],
      [
        '/work/dirty',
        status('/work/dirty', { isDirty: true, ahead: 2, behind: 1 }),
      ],
    ]),
  );
  render(panel([entry('dirty'), entry('clean')]));
  showAll();
  const list = screen.getByRole('list', { name: 'Other cloned repositories' });
  expect(list.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  expect(screen.queryByText('No uncommitted changes')).toBeNull();
  expect(screen.queryByText('Uncommitted changes')).toBeNull();
  expect(screen.getAllByText('Dirty')).toHaveLength(1);
  expect(screen.getByLabelText('2 commits ahead')).not.toBeNull();
  expect(screen.getByLabelText('1 commit behind')).not.toBeNull();
  expect(screen.queryByText('https://github.com/acme/dirty.git')).toBeNull();
  expect(screen.queryByTitle('https://github.com/acme/dirty.git')).toBeNull();
  expect(screen.queryByTestId('cities')).toBeNull();
  expect(actions.getFileTreeForLocalRepo).not.toHaveBeenCalled();
  expect(actions.getWorkingChanges).not.toHaveBeenCalled();
});

test('pending and remote-only repositories are not incorrectly marked clean', () => {
  const remoteOnly = entry('remote', { path: undefined });
  render(panel([entry('pending'), remoteOnly]));
  showAll();
  expect(screen.getByText('Status pending')).not.toBeNull();
  expect(screen.getByText('Not cloned')).not.toBeNull();
  expect(screen.queryByText('No uncommitted changes')).toBeNull();
  expect(screen.queryByText('Dirty')).toBeNull();
  expect(statuses).toHaveBeenCalledWith(['/work/pending']);
});

test('updates dirty and sync indicators when the shared status snapshot changes', () => {
  const repositories = [entry('app')];
  const { rerender } = render(panel(repositories));
  showAll();
  statuses.mockReturnValue(
    new Map([['/work/app', status('/work/app', { isDirty: true, ahead: 1 })]]),
  );
  rerender(panel(repositories));
  expect(screen.getByText('Dirty')).not.toBeNull();
  expect(screen.getByLabelText('1 commit ahead')).not.toBeNull();
  statuses.mockReturnValue(new Map([['/work/app', status('/work/app')]]));
  rerender(panel(repositories));
  expect(screen.queryByText('Dirty')).toBeNull();
  expect(screen.getByText('Synced')).not.toBeNull();
  expect(screen.queryByLabelText('1 commit ahead')).toBeNull();
});

test('opens a repository profile through the existing selection event', () => {
  const repo = entry('app');
  render(panel([repo]));
  showAll();
  fireEvent.click(screen.getByRole('button', { name: 'Open app' }));
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'repository:selected',
      payload: expect.objectContaining({
        purl: 'pkg:github/acme/app',
        localEntry: repo,
      }),
    }),
  );
});

test('a clean working tree does not imply commits have been pushed', () => {
  statuses.mockReturnValue(
    new Map([['/work/app', status('/work/app', { ahead: 2 })]]),
  );
  render(panel([entry('app')]));
  showAll();
  expect(screen.queryByText('Dirty')).toBeNull();
  expect(screen.getByLabelText('2 commits ahead')).not.toBeNull();
  expect(screen.queryByText('Synced')).toBeNull();
});

test.each([false, true])(
  'shows a green main branch with Synced, independently of dirty status (%s)',
  (isDirty) => {
    statuses.mockReturnValue(
      new Map([['/work/app', status('/work/app', { isDirty })]]),
    );
    render(panel([entry('app')]));
    showAll();
    expect(screen.getByText('Synced')).not.toBeNull();
    expect(screen.getByText('main').style.color).toBe('rgb(0, 170, 0)');
    expect(screen.getByText('main').textContent).toBe(
      isDirty ? 'mainDirtySynced' : 'mainSynced',
    );
    expect(screen.queryByText('Dirty') !== null).toBe(isDirty);
    if (isDirty) {
      expect(screen.getByText('Dirty').style.color).toBe('rgb(255, 170, 0)');
    }
  },
);

test.each([{ ahead: 1 }, { behind: 1 }])(
  'does not mark a branch with upstream differences as synced (%o)',
  (counts) => {
    statuses.mockReturnValue(
      new Map([['/work/app', status('/work/app', counts)]]),
    );
    render(panel([entry('app')]));
    showAll();
    expect(screen.queryByText('Synced')).toBeNull();
    expect(screen.getByText('main').style.color).toBe('rgb(170, 170, 170)');
  },
);

test('does not mark pending or local-only repositories as synced', () => {
  statuses.mockReturnValue(new Map([['/work/local', status('/work/local')]]));
  render(panel([entry('pending'), entry('local', { remoteUrl: undefined })]));
  showAll();
  expect(screen.queryByText('Synced')).toBeNull();
});

test('supports a local-only repository without a remote or existing purl', () => {
  render(panel([entry('local', { remoteUrl: undefined })]));
  showAll();
  expect(screen.queryByText('No remote configured')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open local' }));
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'repository:selected',
      payload: expect.objectContaining({
        purl: expect.any(String),
        localEntry: expect.objectContaining({ path: '/work/local' }),
      }),
    }),
  );
});

test('shows an empty state in All when no repositories are registered', () => {
  render(panel([]));
  showAll();
  expect(screen.getByText('No repositories registered yet.')).not.toBeNull();
  expect(screen.queryByTestId('cities')).toBeNull();
});

test('groups personal repositories beneath one owner avatar and other clones together', () => {
  render(
    panel([
      entry('mine', { remoteUrl: 'https://github.com/me/mine.git' }),
      entry('also-mine', { remoteUrl: 'git@github.com:ME/also-mine.git' }),
      entry('dependency'),
      entry('another', {
        remoteUrl: 'https://github.com/elsewhere/another.git',
      }),
    ]),
  );
  showAll();
  const owned = screen.getByRole('region', { name: 'My Account' });
  expect(within(owned).getAllByRole('listitem')).toHaveLength(2);
  expect(within(owned).getAllByRole('img')).toHaveLength(1);
  expect(within(owned).getByRole('img').getAttribute('src')).toBe(
    'https://avatars.example/me.png',
  );
  const other = screen.getByRole('region', { name: 'Other cloned' });
  expect(within(other).getAllByRole('listitem')).toHaveLength(2);
  const dependency = within(other).getByRole('button', {
    name: 'Open dependency',
  });
  expect(
    within(dependency)
      .getByRole('img', { name: 'acme avatar' })
      .getAttribute('src'),
  ).toBe('https://github.com/acme.png?size=64');
  const another = within(other).getByRole('button', { name: 'Open another' });
  expect(
    within(another).getByRole('img', { name: 'elsewhere avatar' }),
  ).not.toBeNull();
});

test('gives member organizations their own section and avatar', () => {
  jest.mocked(useGithubOrganizations).mockReturnValue({
    orgs: [
      {
        login: 'acme',
        name: 'Acme Inc',
        avatar_url: 'https://avatars.example/acme.png',
      },
    ] as ReturnType<typeof useGithubOrganizations>['orgs'],
    loading: false,
  });
  render(panel([entry('company')]));
  showAll();
  const section = screen.getByRole('region', { name: 'Acme Inc' });
  expect(
    within(section)
      .getByRole('img', { name: 'acme avatar' })
      .getAttribute('src'),
  ).toBe('https://avatars.example/acme.png');
  expect(within(section).getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByRole('region', { name: 'Other cloned' })).toBeNull();
});

test('falls back to a repository icon when an owner avatar fails to load', () => {
  render(panel([entry('dependency')]));
  showAll();
  fireEvent.error(screen.getByRole('img', { name: 'acme avatar' }));
  expect(screen.queryByRole('img', { name: 'acme avatar' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Open dependency' }),
  ).not.toBeNull();
});
