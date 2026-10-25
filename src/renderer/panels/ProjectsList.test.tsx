import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { ProjectsList } from './ProjectsList';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: {},
      fonts: {},
      fontSizes: [10, 12, 14],
      fontWeights: {},
    },
  }),
}));
jest.mock('../providers/AuthProvider', () => ({
  useAuthUser: () => ({ isAuthenticated: true }),
}));
jest.mock('../hooks/useGithubProjects', () => ({
  useGithubProjects: () => mockGraph,
}));
jest.mock('../main-process-api/UserPreferencesService', () => ({
  UserPreferencesService: {
    getPreferences: async () => ({ baseDefaultDirectory: '/work' }),
  },
}));
jest.mock('../main-process-api/RepositoryMonitoringService', () => ({
  RepositoryMonitoringService: {
    getGitStatusWithFiles: async () => undefined,
    onGitStatusChanged: () => () => {},
  },
}));
jest.mock('../main-process-api/AlexandriaService', () => ({
  AlexandriaService: {},
}));
jest.mock('../main-process-api/WorkspaceService', () => ({
  WorkspaceService: {},
}));
jest.mock('../main-process-api/FileSystemService', () => ({
  FileSystemService: {},
}));
jest.mock('../main-process-api/GitService', () => ({ GitService: {} }));
jest.mock('../events/repositorySelected', () => ({
  payloadFromLocalEntry: () => ({ purl: 'pkg:github/owner/app' }),
  payloadFromGithub: () => ({ purl: 'pkg:github/owner/remote' }),
}));
jest.mock('./components/RelocateToConventionModal', () => ({
  RelocateToConventionModal: () => null,
}));
jest.mock('./components/CloneFromGitHubModal', () => ({
  CloneFromGitHubModal: ({
    isOpen,
    initialUrl,
  }: {
    isOpen: boolean;
    initialUrl: string;
  }) => (isOpen ? <div role="dialog">{initialUrl}</div> : null),
}));
jest.mock('./components/CreateRepositoryInWorkspaceModal', () => ({
  CreateRepositoryInWorkspaceModal: ({
    isOpen,
    presetOwner,
  }: {
    isOpen: boolean;
    presetOwner: string;
  }) => (isOpen ? <div role="dialog">Create in {presetOwner}</div> : null),
}));
const githubRepo = (name: string) => ({
  name,
  owner: { login: 'owner' },
  html_url: `https://github.com/owner/${name}`,
  clone_url: `https://github.com/owner/${name}.git`,
});
const mockGraph = {
  repos: [githubRepo('app'), githubRepo('remote')],
  starredRepos: [],
  currentUser: 'viewer',
  userOrgs: ['owner'],
  orgs: [{ login: 'owner', name: 'Owner organization' }],
  loading: false,
  refresh: jest.fn(),
  ensureStarred: jest.fn(),
};
const repositories = [
  {
    name: 'app',
    path: '/work/owner/app',
    github: { owner: 'owner', name: 'app' },
  },
] as unknown as AlexandriaEntry[];

function renderProjects(onFilterChange = jest.fn()) {
  const emit = jest.fn();
  render(
    <ProjectsList
      repositories={repositories}
      events={{ emit } as unknown as PanelEventEmitter}
      filter="owned"
      onFilterChange={onFilterChange}
    />,
  );
  return emit;
}

async function ownerHeading() {
  const add = await screen.findByRole('button', {
    name: 'Add a repository to Owner organization',
  });
  return add.parentElement as HTMLElement;
}

beforeEach(() => {
  mockGraph.repos = [githubRepo('app'), githubRepo('remote')];
});

test('filter switch is flush and search reaches the left edge', async () => {
  const changeFilter = jest.fn();
  renderProjects(changeFilter);
  await ownerHeading();
  const owned = screen.getByRole('button', { name: 'Owned' });
  const switcher = owned.parentElement;
  expect(owned.style.borderRadius).toBe('0');
  for (const name of ['Cloned', 'Owned', 'Starred']) {
    const button = screen.getByRole('button', { name });
    expect(button.style.paddingTop).toBe('8px');
    expect(button.style.paddingBottom).toBe('8px');
  }
  expect(switcher?.style.padding).toBe('0px');
  expect(switcher?.parentElement?.style.padding).toBe('0px');
  fireEvent.click(screen.getByRole('button', { name: 'Cloned' }));
  expect(changeFilter).toHaveBeenCalledWith('cloned');
  const field = screen.getByPlaceholderText('Filter projects...').parentElement;
  expect(field?.style.borderRadius).toBe('0');
  expect(field?.parentElement?.style.paddingLeft).toBe('0px');
  expect(field?.parentElement?.style.paddingTop).toBe('0px');
  expect(field?.parentElement?.style.paddingBottom).toBe('0px');
  expect(
    screen.getByRole('button', { name: 'Toggle private repos only' }),
  ).toBeTruthy();
});

test('matches Home styling while keeping owner dropdown behavior', async () => {
  const emit = renderProjects();
  const heading = await ownerHeading();
  const row = screen.getByText('app').closest('[role="button"]') as HTMLElement;
  expect(heading.style.borderRadius).toBe('0');
  expect(heading.style.paddingTop).toBe('12px');
  expect(heading.style.paddingBottom).toBe('10px');
  expect(heading.querySelector('img')?.getAttribute('width')).toBe('22');
  expect(row.style.borderRadius).toBe('0');
  expect(row.style.paddingTop).toBe('8px');
  expect(row.style.paddingBottom).toBe('8px');
  const group = heading.parentElement?.parentElement;
  expect(group?.parentElement?.style.padding).toBe('0px');
  expect(heading.getAttribute('aria-expanded')).toBe('true');
  expect(heading.querySelector('.lucide-chevron-down')).not.toBeNull();
  fireEvent.click(heading);
  expect(heading.getAttribute('aria-expanded')).toBe('false');
  expect(heading.querySelector('.lucide-chevron-right')).not.toBeNull();
  expect(screen.queryByText('app')).toBeNull();
  fireEvent.click(heading);
  expect(screen.getByText('app')).toBeTruthy();
  expect(emit).not.toHaveBeenCalled();
});

test('the owner add action still works without toggling the dropdown', async () => {
  renderProjects();
  const heading = await ownerHeading();
  fireEvent.click(heading);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Add a repository to Owner organization',
    }),
  );
  expect(screen.getByRole('dialog').textContent).toBe('Create in owner');
  expect(heading.getAttribute('aria-expanded')).toBe('false');
});

test('keeps project profile, terminal, clone, and remove actions', async () => {
  const emit = renderProjects();
  await ownerHeading();
  fireEvent.click(screen.getByText('app'));
  expect(emit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: 'repository:selected',
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Open a terminal in app' }),
  );
  expect(emit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: 'terminal:new',
      payload: { directory: '/work/owner/app', label: 'app' },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clone remote' }));
  expect(screen.getByRole('dialog').textContent).toBe(
    'https://github.com/owner/remote.git',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove app from list' }));
  expect(screen.getByText('Remove from list?')).toBeTruthy();
});

test('large owner groups still collapse by default and reveal search results', async () => {
  mockGraph.repos = Array.from({ length: 11 }, (_, i) =>
    githubRepo(`repo-${i}`),
  );
  renderProjects();
  const heading = await ownerHeading();
  expect(heading.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('repo-1')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Filter projects...'), {
    target: { value: 'repo-1' },
  });
  expect(heading.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('repo-1')).toBeTruthy();
});
