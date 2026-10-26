import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { HomeRepoRow, HomeTabEntry } from './homeTabEntries';
import { HomeLeftPanel, type HomeLeftPanelProps } from './HomeLeftPanel';
import { buildHomeTabEntries } from './homeTabEntries';

const mockOpenOrgProfile = jest.fn();

jest.mock('@industry-theme/xterm-terminal-panel', () => ({
  ProgramStatusBadge: ({ record }: { record: { state: string } }) => (
    <span data-testid="program-status-badge" data-state={record.state} />
  ),
}));

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: { border: '#123456' },
      fonts: {},
      fontSizes: [10, 12, 14],
      fontWeights: {},
    },
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
  useGithubOrganizations: () => ({
    orgs: [{ login: 'owner', name: 'Owner organization' }],
  }),
  useGithubProjectSections: () => [],
  useGithubStarred: () => ({ starredRepos: [], ensure: jest.fn() }),
}));
jest.mock('./UserAboutCard', () => ({ UserAboutCard: () => null }));
jest.mock('./RepoAboutCard', () => ({ RepoAboutCard: () => null }));
jest.mock('./useInProgressRepos', () => ({
  useInProgressRepos: () => [],
}));
jest.mock('./homeTabEntries', () => ({
  buildHomeTabEntries: jest.fn(),
  isHomeTabPinnable: () => true,
}));
jest.mock('./usePinnedRepoScopes', () => ({
  usePinnedRepoScopes: () => new Map(),
}));
jest.mock('./useHomePins', () => ({
  useHomePins: () => ({
    pinnedTabs: [],
    pinnedRepos: [],
    pinnedRepoKeys: new Set(),
    toggleRepoPin: jest.fn(),
  }),
}));
jest.mock('../../principal-window/PortalTabsContext', () => ({
  useWorkspaceTabs: () => ({
    savedRequests: [],
    catalogRequests: [],
    openOrgProfile: mockOpenOrgProfile,
  }),
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

function renderHome(
  row = repo,
  onOpenEntry = jest.fn(),
  pinnedTabs: HomeRepoRow['pinnedTabs'] = [],
  openTabs: HomeRepoRow['openTabs'] = [],
  programStatusByTab?: HomeLeftPanelProps['programStatusByTab'],
) {
  jest.mocked(buildHomeTabEntries).mockReturnValue({
    repos: [row],
    requests: [],
    processTabs: new Map(),
    processes: [],
    openTabs,
    pinnedTabs,
  });
  const emit = jest.fn();
  render(
    <HomeLeftPanel
      repositories={[]}
      tabs={[]}
      programStatusByTab={programStatusByTab}
      events={{ emit } as unknown as PanelEventEmitter}
      aboutUser={null}
      userLoading={false}
      activeTabId={null}
      onActivateTab={jest.fn()}
      onOpenEntry={onOpenEntry}
    />,
  );
  return emit;
}

beforeEach(() => {
  mockOpenOrgProfile.mockClear();
});

test.each(
  (['topic', 'subsystem-model'] as const).flatMap((kind) =>
    [true, false].flatMap((open) =>
      [true, false].map((nested) => ({ kind, open, nested })),
    ),
  ),
)(
  'drags $kind context when open=$open and nested=$nested',
  ({ kind, open, nested }) => {
    const entry: HomeTabEntry = {
      id: 'context-entry',
      kind,
      label: 'Context entry',
      topicId: kind === 'topic' ? 't1' : undefined,
      modelId: kind === 'subsystem-model' ? 'sg-1-abc' : undefined,
    };
    const openTabs = open ? [entry] : [];
    const pinnedTabs = open ? [] : [entry];
    renderHome(
      {
        ...repo,
        openTabs: nested ? openTabs : [],
        pinnedTabs: nested ? pinnedTabs : [],
      },
      jest.fn(),
      nested ? [] : pinnedTabs,
      nested ? [] : openTabs,
    );
    const row = screen.getByRole('button', { name: 'Open Context entry' });
    expect(row.draggable).toBe(true);
    const dataTransfer = { effectAllowed: 'none', setData: jest.fn() };
    fireEvent.dragStart(row, { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'text/plain',
      expect.stringContaining(
        kind === 'topic' ? '/api/topics/t1' : '/api/subsystem-models/sg-1-abc',
      ),
    );
  },
);

test('Home rows have square edges and no outer horizontal inset', () => {
  renderHome(repo, jest.fn(), [
    { id: 'topic', kind: 'topic', label: 'Standalone topic', topicId: 't1' },
  ]);
  const owner = screen
    .getByText('Owner organization')
    .closest('[role="button"]');
  const repository = screen.getByText('app').closest('[role="button"]');
  const tab = screen.getByRole('button', { name: 'Open Standalone topic' });
  if (!owner || !(repository instanceof HTMLElement))
    throw new Error('Missing Home rows');
  expect((owner as HTMLElement).style.borderRadius).toBe('0');
  expect(repository.style.borderRadius).toBe('0');
  expect(tab.style.borderRadius).toBe('0');
  expect(owner.hasAttribute('title')).toBe(false);
  expect(repository.querySelector('[title]')).toBeNull();
  expect(repository.hasAttribute('title')).toBe(false);
  expect(tab.querySelector('[title]')).toBeNull();
  expect(tab.hasAttribute('title')).toBe(false);
  expect(repository.style.paddingLeft).toBe('14px');
  expect(tab.style.paddingLeft).toBe('14px');
  const list = repository.parentElement?.parentElement?.parentElement;
  expect(list?.style.paddingLeft).toBe('0px');
  expect(list?.style.paddingRight).toBe('0px');
  expect(list?.style.paddingTop).toBe('0px');
  expect(list?.style.paddingBottom).toBe('0px');
  expect((owner as HTMLElement).style.paddingTop).toBe('12px');
  expect((owner as HTMLElement).style.paddingBottom).toBe('10px');
  for (const row of [repository, tab]) {
    expect(row.style.paddingTop).toBe('8px');
    expect(row.style.paddingBottom).toBe('8px');
  }
  expect(repository.parentElement?.parentElement?.style.marginBottom).toBe('');
});

test('owner headings open the org profile by login without collapsing repositories', () => {
  const emit = renderHome();
  const header = screen
    .getByText('Owner organization')
    .closest('[role="button"]');
  if (!header) throw new Error('Missing owner heading');
  expect(header.hasAttribute('aria-expanded')).toBe(false);
  expect(header.querySelector('.lucide-chevron-down')).toBeNull();
  expect(header.querySelector('.lucide-chevron-right')).toBeNull();
  fireEvent.click(header);
  expect(mockOpenOrgProfile).toHaveBeenCalledWith('owner');
  expect(screen.getByText('app')).toBeTruthy();
  fireEvent.keyDown(header, { key: 'Enter' });
  expect(mockOpenOrgProfile).toHaveBeenCalledTimes(2);
  expect(screen.getByText('app')).toBeTruthy();
  expect(emit).not.toHaveBeenCalled();
});

test('Untracked stays expanded and does not open an organization profile', () => {
  renderHome({
    ...repo,
    payload: { ...repo.payload, github: undefined },
  });
  const label = screen.getByText('Untracked');
  expect(label.closest('[role="button"]')).toBeNull();
  fireEvent.click(label);
  expect(mockOpenOrgProfile).not.toHaveBeenCalled();
  expect(screen.getByText('app')).toBeTruthy();
});

test.each(['Open Tabs', 'Pinned'])(
  'separates the %s heading from its content with an owner-style divider',
  (heading) => {
    const entries: HomeRepoRow['pinnedTabs'] = [
      { id: 'topic', kind: 'topic', label: 'Standalone topic', topicId: 't1' },
    ];
    renderHome(
      repo,
      jest.fn(),
      heading === 'Pinned' ? entries : [],
      heading === 'Open Tabs' ? entries : [],
    );
    const divider = screen.getByRole('separator');
    const header = screen.getByText(heading).parentElement;
    const icon = header?.querySelector('svg');
    expect(icon?.getAttribute('width')).toBe('22');
    expect(icon?.getAttribute('height')).toBe('22');
    expect(header?.style.paddingTop).toBe('12px');
    expect(header?.style.paddingBottom).toBe('10px');
    expect(screen.getByText(heading).parentElement?.nextElementSibling).toBe(
      divider,
    );
    expect(divider.style.height).toBe('1px');
    expect(divider.style.backgroundColor).toBe('rgb(18, 52, 86)');
    expect(divider.style.margin).toBe('5px 10px 0px');
    expect(
      divider.nextElementSibling?.contains(
        screen.getByText('Standalone topic'),
      ),
    ).toBe(true);
  },
);

test('shows a pin icon before the Pinned section label', () => {
  renderHome(repo, jest.fn(), [
    { id: 'topic', kind: 'topic', label: 'Standalone topic', topicId: 't1' },
  ]);
  const label = screen.getByText('Pinned');
  const icon = label.previousElementSibling;
  expect(icon?.classList.contains('lucide-pin')).toBe(true);
  expect(icon?.getAttribute('aria-hidden')).toBe('true');
  expect(label.parentElement?.firstElementChild).toBe(icon);
});

test('clicking a Home repo opens its terminal without a separate terminal button', () => {
  const emit = renderHome();
  expect(
    screen.queryByRole('button', { name: 'Open a terminal in app' }),
  ).toBeNull();
  fireEvent.click(screen.getByText('app'));
  expect(emit).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'terminal:new',
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

test('closed topic and model pins render as named children, not compact repo icons', () => {
  const pins: HomeRepoRow['pinnedTabs'] = [
    { id: 'topic', kind: 'topic', label: 'Pinned topic', topicId: 't1' },
    {
      id: 'model',
      kind: 'subsystem-model',
      label: 'Pinned model',
      modelId: 'm1',
    },
  ];
  const open = jest.fn();
  const emit = renderHome({ ...repo, pinnedTabs: pins }, open);
  const group = screen
    .getByText('app')
    .closest('[role="button"]')?.parentElement;
  if (!group) throw new Error('Missing repository group');
  for (const pin of pins) {
    expect(within(group).getByText(pin.label)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: `Reopen pinned tab ${pin.label}` }),
    ).toBeNull();
    fireEvent.click(screen.getByText(pin.label));
    expect(open).toHaveBeenLastCalledWith(pin);
  }
  expect(screen.getByRole('button', { name: 'Pin app to Home' })).toBeTruthy();
  expect(emit).not.toHaveBeenCalled();
});

test('shows independent OSC status for terminal children sharing a repository', () => {
  const openTabs: HomeRepoRow['openTabs'] = [
    {
      id: 'tab-one',
      kind: 'terminal',
      label: 'Terminal 1',
      path: '/work/app',
      repoPath: '/work/app',
    },
    {
      id: 'tab-two',
      kind: 'terminal',
      label: 'Terminal 2',
      path: '/work/app',
      repoPath: '/work/app',
    },
  ];
  renderHome({ ...repo, openTabs }, jest.fn(), [], [], {
    'tab-one': { state: 'working' },
    'tab-two': { state: 'blocked', kind: 'question' },
  });
  expect(
    within(screen.getByRole('button', { name: 'Open Terminal 1' }))
      .getByRole('status')
      .getAttribute('aria-label'),
  ).toBe('Terminal working');
  expect(
    within(screen.getByRole('button', { name: 'Open Terminal 2' }))
      .getByRole('status')
      .getAttribute('aria-label'),
  ).toBe('Terminal blocked: question');
});

test('shows OSC status for a standalone terminal, not a closed or nonterminal entry', () => {
  renderHome(
    repo,
    jest.fn(),
    [
      {
        id: 'closed-topic',
        kind: 'topic',
        label: 'Closed topic',
        topicId: 't1',
      },
    ],
    [{ id: 'standalone', kind: 'terminal', label: 'Tab 3', path: '/scratch' }],
    {
      standalone: { state: 'error' },
      'closed-topic': { state: 'working' },
    },
  );
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(
    within(screen.getByRole('button', { name: 'Open terminal in /scratch' }))
      .getByRole('status')
      .getAttribute('aria-label'),
  ).toBe('Terminal error');
});
