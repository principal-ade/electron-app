import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { githubClient } from '../../../tipc/githubClient';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { useGithubProjectSections } from '../../../hooks/useGithubGraph';
import { TitlebarGitHubSearch } from './TitlebarGitHubSearch';

const mockPrincipalEmit = jest.fn();
const mockPortalEmit = jest.fn();
const mockOpenProjectInfo = jest.fn();
const mockOpenUserProfile = jest.fn();

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: { colors: {}, fonts: {}, fontSizes: [10, 12, 14] },
  }),
}));
jest.mock('../../../tipc/githubClient', () => ({
  githubClient: { searchRepos: jest.fn(), searchUsers: jest.fn() },
}));
jest.mock('../../../main-process-api/AlexandriaService', () => ({
  AlexandriaService: { searchRepositories: jest.fn() },
}));
jest.mock('../../PrincipalEventContext', () => ({
  usePrincipalEvents: () => ({ events: { emit: mockPrincipalEmit } }),
}));
jest.mock('../../PortalEventContext', () => ({
  usePortalEvents: () => ({ events: { emit: mockPortalEmit } }),
}));
jest.mock('../../contexts/ProjectsTabsContext', () => ({
  useProjectsTabs: () => ({
    openProjectInfo: mockOpenProjectInfo,
    openUserProfile: mockOpenUserProfile,
  }),
}));
jest.mock('../../../hooks/useGithubGraph', () => ({
  useGithubProjectSections: jest.fn(() => null),
}));

const repo = {
  id: 1,
  name: 'remote-app',
  full_name: 'owner/remote-app',
  owner: { login: 'owner', avatar_url: 'https://example.com/avatar' },
};
const local = {
  name: 'local-app',
  path: '/work/local-app',
  purl: 'pkg:github/owner/local-app',
};

const ownRepo = {
  id: 10,
  name: 'app-kit',
  full_name: 'me/app-kit',
  owner: { login: 'me', avatar_url: 'https://example.com/me.png' },
};
const orgRepo = {
  id: 11,
  name: 'app-service',
  full_name: 'acme/app-service',
  description: 'Internal app service',
  owner: { login: 'acme', avatar_url: 'https://example.com/acme.png' },
};
const orgNonMatch = {
  id: 12,
  name: 'website',
  full_name: 'acme/website',
  owner: { login: 'acme', avatar_url: 'https://example.com/acme.png' },
};

const projectSections = [
  { key: 'me', label: 'Your repositories', repos: [ownRepo] },
  {
    key: 'acme',
    label: 'Acme Inc',
    avatar_url: 'https://example.com/acme.png?v=4',
    repos: [orgRepo, orgNonMatch],
  },
];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (useGithubProjectSections as jest.Mock).mockReturnValue(null);
  (AlexandriaService.searchRepositories as jest.Mock).mockResolvedValue([
    local,
  ]);
  (githubClient.searchRepos as jest.Mock).mockResolvedValue({ repos: [repo] });
  (githubClient.searchUsers as jest.Mock).mockResolvedValue({
    users: [{ id: 2, login: 'unwanted-user', name: 'Unwanted user' }],
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function search() {
  render(<TitlebarGitHubSearch />);
  const input = screen.getByPlaceholderText('Search GitHub...');
  fireEvent.change(input, { target: { value: 'app' } });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  return input;
}

test('searches local clones and GitHub repositories without requesting users', async () => {
  await search();
  expect(AlexandriaService.searchRepositories).toHaveBeenCalledWith('app');
  expect(githubClient.searchRepos).toHaveBeenCalledWith({
    query: 'app',
    perPage: 5,
  });
  expect(githubClient.searchUsers).not.toHaveBeenCalled();
  expect(screen.getByText('Local clones')).toBeTruthy();
  expect(screen.getByText('Repositories')).toBeTruthy();
  expect(screen.getByText('local-app')).toBeTruthy();
  expect(screen.getByText('owner/remote-app')).toBeTruthy();
  expect(screen.queryByText('Users')).toBeNull();
  expect(screen.queryByText(/unwanted-user/)).toBeNull();
});

test('keyboard navigation moves directly from local clones to repositories', async () => {
  const input = await search();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockOpenProjectInfo).toHaveBeenCalledWith(
    expect.objectContaining({ purl: 'pkg:github/owner/remote-app' }),
  );
  expect(mockOpenUserProfile).not.toHaveBeenCalled();
  expect(mockPortalEmit).not.toHaveBeenCalled();
});

test('Enter still opens a local clone in a terminal', async () => {
  const input = await search();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockPortalEmit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'terminal:new',
      payload: { directory: local.path, label: local.name },
    }),
  );
  expect(mockOpenProjectInfo).not.toHaveBeenCalled();
});

test('repository results still open by mouse when there are no local clones', async () => {
  (AlexandriaService.searchRepositories as jest.Mock).mockResolvedValue([]);
  await search();
  fireEvent.mouseDown(screen.getByText('owner/remote-app'));
  expect(mockOpenProjectInfo).toHaveBeenCalledWith(
    expect.objectContaining({ purl: 'pkg:github/owner/remote-app' }),
  );
});

describe('project graph groups', () => {
  beforeEach(() => {
    (useGithubProjectSections as jest.Mock).mockReturnValue(projectSections);
  });

  test('shows your repos and one group per org, filtered by the query', async () => {
    await search();
    expect(screen.getByText('Your repositories')).toBeTruthy();
    expect(screen.getByText('Acme Inc')).toBeTruthy();
    // Matches by name (app-kit, app-service); non-matching org repo is hidden.
    expect(screen.getByText('me/app-kit')).toBeTruthy();
    expect(screen.getByText('acme/app-service')).toBeTruthy();
    expect(screen.queryByText('acme/website')).toBeNull();
  });

  test('groups hide themselves when nothing matches', async () => {
    (useGithubProjectSections as jest.Mock).mockReturnValue([
      { key: 'acme', label: 'Acme Inc', repos: [orgNonMatch] },
    ]);
    await search();
    expect(screen.queryByText('Acme Inc')).toBeNull();
    expect(screen.queryByText('acme/website')).toBeNull();
    // Search still falls through to clones + global results.
    expect(screen.getByText('Local clones')).toBeTruthy();
    expect(screen.getByText('owner/remote-app')).toBeTruthy();
  });

  test('a repo that is also cloned appears only as the clone row', async () => {
    (AlexandriaService.searchRepositories as jest.Mock).mockResolvedValue([
      {
        name: 'app-service',
        path: '/work/app-service',
        purl: 'pkg:github/acme/app-service',
      },
    ]);
    await search();
    expect(screen.queryByText('acme/app-service')).toBeNull();
    expect(screen.getByText('app-service')).toBeTruthy();
    expect(screen.getByText('/work/app-service')).toBeTruthy();
  });

  test('global hits already grouped stay in their group only', async () => {
    (githubClient.searchRepos as jest.Mock).mockResolvedValue({
      repos: [
        { ...orgRepo, id: 99 },
        { ...repo, id: 100 },
      ],
    });
    await search();
    // One row for the org repo, not two.
    expect(screen.getAllByText('acme/app-service')).toHaveLength(1);
    expect(screen.getByText('owner/remote-app')).toBeTruthy();
  });

  test('Enter on the first row opens the first project group result', async () => {
    const input = await search();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOpenProjectInfo).toHaveBeenLastCalledWith(
      expect.objectContaining({ purl: 'pkg:github/me/app-kit' }),
    );
  });

  test('keyboard navigation runs project groups → clones → global', async () => {
    const input = await search();
    // Flat order: me/app-kit, acme/app-service, local-app, owner/remote-app.
    for (let i = 0; i < 3; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPortalEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'terminal:new',
        payload: { directory: local.path, label: local.name },
      }),
    );
    expect(mockOpenProjectInfo).not.toHaveBeenCalled();
  });
});

test('pasting a GitHub profile URL still opens that profile directly', async () => {
  render(<TitlebarGitHubSearch />);
  fireEvent.paste(screen.getByPlaceholderText('Search GitHub...'), {
    clipboardData: { getData: () => 'https://github.com/owner' },
  });
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockOpenUserProfile).toHaveBeenCalledWith('owner');
  expect(githubClient.searchUsers).not.toHaveBeenCalled();
});
