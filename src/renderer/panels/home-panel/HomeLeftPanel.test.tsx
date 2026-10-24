import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { HomeRepoRow } from './homeTabEntries';
import { HomeLeftPanel } from './HomeLeftPanel';
import { buildHomeTabEntries } from './homeTabEntries';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14], fontWeights: {} },
  }),
}));
jest.mock('@principal-ai/alexandria-core-library', () => ({
  githubIdToPurl: jest.fn(),
}));
jest.mock('../../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: () => new Promise(() => {}),
    onPreferencesUpdated: () => () => {},
  },
}));
jest.mock('../../main-process-api/GitService', () => ({ GitService: {} }));
jest.mock('../../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {},
}));
jest.mock('../../providers/AuthProvider', () => ({
  useAuthUser: () => ({}),
}));
jest.mock('../../hooks/useGithubGraph', () => ({
  useGithubOrganizations: () => ({ orgs: [] }),
  useGithubProjectSections: () => [],
  useGithubStarred: () => ({ starredRepos: [], ensure: jest.fn() }),
}));
jest.mock('./UserAboutCard', () => ({ UserAboutCard: () => null }));
jest.mock('./RepoAboutCard', () => ({ RepoAboutCard: () => null }));
jest.mock('./useInProgressRepos', () => ({
  useInProgressRepos: () => [],
}));
jest.mock('./homeTabEntries', () => ({ buildHomeTabEntries: jest.fn() }));
jest.mock('./useHomePins', () => ({
  useHomePins: () => ({
    pinnedTabs: [],
    pinnedRepos: [],
    pinnedRepoKeys: new Set(),
    toggleRepoPin: jest.fn(),
  }),
}));
jest.mock('../../principal-window/PortalTabsContext', () => ({
  useWorkspaceTabs: () => ({ savedRequests: [], catalogRequests: [] }),
}));
jest.mock('../../requests/RequestGroupList', () => ({
  RequestGroupList: () => null,
}));
jest.mock('./useWatchedRepos', () => ({ useWatchedRepos: () => new Set() }));
jest.mock('./HomeSearch', () => ({
  HomeSearchBar: () => null,
  HomeSearchResults: () => null,
}));
jest.mock('../components/PushToRemoteModal', () => ({
  PushToRemoteModal: () => null,
}));
jest.mock('../../hooks/useProcessRegistry', () => ({
  useProcessRegistry: () => ({ entries: [] }),
}));
jest.mock('./HomeProcessRow', () => ({ HomeProcessRow: () => null }));

const repo = {
  key: '/work/app',
  payload: {
    purl: 'pkg:github/owner/app',
    github: { owner: 'owner', name: 'app' },
    localEntry: { name: 'app', path: '/work/app' },
  },
  openTabs: [],
  pinnedTabs: [],
  processes: [],
  pinned: false,
} as unknown as HomeRepoRow;

function renderHome(row = repo) {
  jest.mocked(buildHomeTabEntries).mockReturnValue({
    repos: [row],
    requests: [],
    processTabs: new Map(),
    processes: [],
    openTabs: [],
    pinnedTabs: [],
  });
  const emit = jest.fn();
  render(
    <HomeLeftPanel
      repositories={[]}
      tabs={[]}
      events={{ emit } as unknown as PanelEventEmitter}
      aboutUser={null}
      userLoading={false}
      activeTabId={null}
      onActivateTab={jest.fn()}
      onOpenEntry={jest.fn()}
    />,
  );
  return emit;
}

test('clicking a Home repo opens its terminal without a separate terminal button', () => {
  const emit = renderHome();
  expect(
    screen.queryByRole('button', { name: 'Open a terminal in app' }),
  ).toBeNull();
  fireEvent.click(screen.getByText('app'));
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'terminal:open',
      payload: { directory: '/work/app', label: 'app' },
    }),
  );
});

test('right-clicking a Home repo opens only its profile and prevents the context menu', () => {
  const emit = renderHome();
  expect(fireEvent.contextMenu(screen.getByText('app'))).toBe(false);
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'repository:selected',
      payload: repo.payload,
    }),
  );
});

test('a Home repo without a local clone still opens its profile on click', () => {
  const emit = renderHome({
    ...repo,
    payload: { ...repo.payload, localEntry: undefined },
  });
  fireEvent.click(screen.getByText('app'));
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'repository:selected' }),
  );
});

test('clicking the repo pin does not open a terminal or profile', () => {
  const emit = renderHome();
  fireEvent.click(screen.getByRole('button', { name: 'Pin app to Home' }));
  expect(emit).not.toHaveBeenCalled();
});
