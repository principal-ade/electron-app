import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { githubClient } from '../../../tipc/githubClient';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
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

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
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
