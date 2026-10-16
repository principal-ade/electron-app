import type { Meta, StoryObj } from '@storybook/react-webpack5';
import React from 'react';
import { ThemeProvider, slateNeonTheme } from '@principal-ade/industry-theme';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { ProjectsList, type ProjectFilter } from './ProjectsList';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AuthProvider } from '../providers/AuthProvider';

// ---------- mock plumbing ----------
//
// ProjectsList draws from two independent sources, both mocked here:
//
//  1. useGithubProjects() fans out to five GithubService calls
//     (getCurrentUser / getUserOrganizations / getUserRepositories /
//     getOrgRepositories / getUserStarredRepositories). Every one must resolve
//     or the panel sits on "Loading projects…". We rewire all five to read from
//     a mutable `activeMocks` cell, swapped per-story.
//  2. The `repositories` prop carries local clones (AlexandriaEntry[]); a
//     clone is "dirty" when RepositoryMonitoringService.getGitStatusWithFiles
//     reports isDirty, so we stub that to read from a per-story dirty-path set
//     and stub onGitStatusChanged to a no-op subscription.

type MockState = {
  currentUser: string | null;
  orgs: string[];
  /** GitHub repos returned for the user + every org, keyed nowhere — the hook dedupes by full_name. */
  githubRepos: GitHubRepository[] | 'pending' | 'reject';
  /** Starred repos (may be third-party repos the user doesn't own). */
  starredRepos: GitHubRepository[];
  /** Absolute paths whose clone should report as dirty. */
  dirtyPaths: Set<string>;
};

let activeMocks: MockState = {
  currentUser: null,
  orgs: [],
  githubRepos: [],
  starredRepos: [],
  dirtyPaths: new Set(),
};

/** Set per-story before returning the rendered element. */
const withMocks = (state: Partial<MockState>): void => {
  activeMocks = {
    currentUser: null,
    orgs: [],
    githubRepos: [],
    starredRepos: [],
    dirtyPaths: new Set(),
    ...state,
  };
};

const resolveRepos = (): Promise<GitHubRepository[]> => {
  const v = activeMocks.githubRepos;
  if (v === 'pending') return new Promise<GitHubRepository[]>(() => {});
  if (v === 'reject') return Promise.reject(new Error('signed out'));
  return Promise.resolve(v);
};

const asOrg = (login: string) => ({
  login,
  id: login.length,
  avatar_url: '',
  description: null,
});

(
  GithubService as unknown as { getCurrentUser: typeof GithubService.getCurrentUser }
).getCurrentUser = async () =>
  activeMocks.currentUser
    ? ({ login: activeMocks.currentUser } as Awaited<ReturnType<typeof GithubService.getCurrentUser>>)
    : null;
(
  GithubService as unknown as {
    getUserOrganizations: typeof GithubService.getUserOrganizations;
  }
).getUserOrganizations = async () =>
  activeMocks.orgs.map(asOrg) as Awaited<ReturnType<typeof GithubService.getUserOrganizations>>;
// The hook fetches the user's repos and each org's repos, then dedupes by
// full_name. We return the whole fixture set for the user call and an empty
// list for every org call — the merged result is identical, with no dupes.
(
  GithubService as unknown as {
    getUserRepositories: typeof GithubService.getUserRepositories;
  }
).getUserRepositories = async () => resolveRepos();
(
  GithubService as unknown as {
    getOrgRepositories: typeof GithubService.getOrgRepositories;
  }
).getOrgRepositories = async () => [];
(
  GithubService as unknown as {
    getUserStarredRepositories: typeof GithubService.getUserStarredRepositories;
  }
).getUserStarredRepositories = async () => activeMocks.starredRepos;

(
  RepositoryMonitoringService as unknown as {
    getGitStatusWithFiles: typeof RepositoryMonitoringService.getGitStatusWithFiles;
  }
).getGitStatusWithFiles = async (repoPath: string) =>
  ({ repoPath, isDirty: activeMocks.dirtyPaths.has(repoPath) } as GitStatusWithFiles);
(
  RepositoryMonitoringService as unknown as {
    onGitStatusChanged: typeof RepositoryMonitoringService.onGitStatusChanged;
  }
).onGitStatusChanged = () => () => {};

// Auth: the shared AuthProvider reads `window.mainProcess.authentication` (the
// global Storybook mock is signed out). Point it at the per-story currentUser so
// the panel renders signed in — that's what gates the filter switch and drives
// useGithubProjects' fan-out (whose GithubService calls are mocked above).
if (typeof window !== 'undefined') {
  const mainProcess = ((window as unknown as { mainProcess?: unknown }).mainProcess ??
    {}) as Record<string, unknown>;
  (window as unknown as { mainProcess: unknown }).mainProcess = mainProcess;
  mainProcess.authentication = {
    ...(mainProcess.authentication as Record<string, unknown> | undefined),
    getAuthState: async () =>
      activeMocks.currentUser
        ? {
            isAuthenticated: true,
            user: {
              login: activeMocks.currentUser,
              email: `${activeMocks.currentUser}@example.com`,
              name: activeMocks.currentUser,
              id: 1,
              avatarUrl: `https://github.com/${activeMocks.currentUser}.png`,
            },
            lastChecked: Date.now(),
          }
        : { isAuthenticated: false, user: null, lastChecked: Date.now() },
    onAuthStateChanged: () => () => {},
  };
}

// Panel event emitter — ProjectsList only ever calls events.emit(); log it so
// clicking a project is observable in the Actions/console.
const events = {
  emit: (event: unknown) => console.info('[ProjectsList event]', event),
  on: () => () => {},
  off: () => {},
} as unknown as PanelEventEmitter;

/**
 * ProjectsList now takes its filter from the shell (so it survives side-panel
 * switches). Hold it here so the Storybook switch stays interactive.
 */
const ProjectsListStory: React.FC<{ repositories?: AlexandriaEntry[] }> = ({
  repositories,
}) => {
  const [filter, setFilter] = React.useState<ProjectFilter>('cloned');
  return (
    <ProjectsList
      repositories={repositories}
      events={events}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
};

// ---------- fixtures ----------

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

const ghRepo = (
  owner: string,
  name: string,
  over: Partial<GitHubRepository> = {},
): GitHubRepository => ({
  id: `${owner}/${name}`.length,
  name,
  full_name: `${owner}/${name}`,
  owner: { login: owner, avatar_url: '', type: 'Organization' },
  private: false,
  html_url: `https://github.com/${owner}/${name}`,
  description: null,
  fork: false,
  clone_url: `https://github.com/${owner}/${name}.git`,
  updated_at: daysAgo(10),
  pushed_at: daysAgo(10),
  language: null,
  default_branch: 'main',
  ...over,
});

// A local clone on disk. `path` is the registry primary key and the git-status
// lookup key; `github` upgrades a matching GitHub repo to "cloned".
const localEntry = (
  owner: string,
  name: string,
  over: Partial<AlexandriaEntry> = {},
): AlexandriaEntry =>
  ({
    name,
    path: `/Users/dev/code/${name}`,
    remoteUrl: `https://github.com/${owner}/${name}.git`,
    registeredAt: daysAgo(30),
    lastOpenedAt: hoursAgo(2),
    hasViews: false,
    viewCount: 0,
    views: [],
    github: {
      owner,
      name,
      description: `${name} — local clone`,
      lastCommit: hoursAgo(5),
    },
    ...over,
  }) as unknown as AlexandriaEntry;

// GitHub repos across the user's own account + two orgs.
const githubFixtures: GitHubRepository[] = [
  ghRepo('octocat', 'dotfiles', {
    description: 'Personal shell + editor config',
    pushed_at: hoursAgo(6),
    owner: { login: 'octocat', avatar_url: '', type: 'User' },
  }),
  ghRepo('octocat', 'scratchpad', {
    description: 'Throwaway experiments',
    pushed_at: daysAgo(3),
    owner: { login: 'octocat', avatar_url: '', type: 'User' },
  }),
  ghRepo('principal-ade', 'desktop-app', {
    description: 'The Alexandria desktop application',
    pushed_at: hoursAgo(1),
  }),
  ghRepo('principal-ade', 'web-ade', {
    description: 'Web companion for Alexandria',
    pushed_at: daysAgo(2),
  }),
  ghRepo('principal-ade', 'panel-framework-core', {
    description: 'Panel contract + harness',
    pushed_at: daysAgo(8),
  }),
  ghRepo('acme-corp', 'billing-service', {
    description: 'Invoices and subscriptions',
    pushed_at: daysAgo(5),
  }),
  ghRepo('acme-corp', 'design-tokens', {
    description: null,
    pushed_at: daysAgo(20),
  }),
];

// Local clones: two of the principal-ade repos are checked out (one dirty),
// plus an untracked clone with no GitHub metadata.
const localFixtures: AlexandriaEntry[] = [
  localEntry('principal-ade', 'desktop-app', { lastOpenedAt: hoursAgo(1) }),
  localEntry('principal-ade', 'web-ade', { lastOpenedAt: daysAgo(1) }),
  {
    name: 'local-notes',
    path: '/Users/dev/code/local-notes',
    registeredAt: daysAgo(4),
    lastOpenedAt: hoursAgo(3),
    hasViews: false,
    viewCount: 0,
    views: [],
  } as unknown as AlexandriaEntry,
];

// Starred repos: a third-party repo the user doesn't own (so it only appears
// because it's starred), plus one the user owns (so it's marked, not duplicated).
const starredFixtures: GitHubRepository[] = [
  ghRepo('sindresorhus', 'awesome', {
    description: 'A curated list of awesome things',
    owner: { login: 'sindresorhus', avatar_url: '', type: 'User' },
  }),
  ghRepo('octocat', 'dotfiles', {
    owner: { login: 'octocat', avatar_url: '', type: 'User' },
  }),
];

// ---------- meta ----------

const meta: Meta<typeof ProjectsList> = {
  title: 'Panels/ProjectsList',
  component: ProjectsList,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ThemeProvider theme={slateNeonTheme}>
        <AuthProvider>
          <div style={{ width: '100vw', height: '100vh' }}>
            <Story />
          </div>
        </AuthProvider>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The full "My Projects" list: GitHub repos across the signed-in user
 * (octocat) plus the acme-corp and principal-ade orgs, merged with three
 * local clones and two starred repos. principal-ade is the user's own/member
 * org so it sorts first with a badge. The filter chips are Owned / Cloned /
 * Starred; "sindresorhus/awesome" only appears under Starred (it isn't owned
 * or cloned).
 */
export const Default: Story = {
  render: () => {
    withMocks({
      currentUser: 'octocat',
      orgs: ['principal-ade', 'acme-corp'],
      githubRepos: githubFixtures,
      starredRepos: starredFixtures,
      dirtyPaths: new Set(['/Users/dev/code/web-ade']),
    });
    return <ProjectsListStory repositories={localFixtures} />;
  },
};

/**
 * No GitHub auth (the hook rejects) and no local clones — the empty "No
 * projects" state with the folder glyph.
 */
export const Empty: Story = {
  render: () => {
    withMocks({ githubRepos: 'reject' });
    return <ProjectsListStory repositories={[]} />;
  },
};

/**
 * Only local clones, no GitHub repos resolved (signed out). The list still
 * renders from the registry, grouped by owner with "Untracked" pinned last.
 */
export const LocalOnly: Story = {
  render: () => {
    withMocks({
      githubRepos: 'reject',
      dirtyPaths: new Set(['/Users/dev/code/web-ade']),
    });
    return <ProjectsListStory repositories={localFixtures} />;
  },
};

/**
 * The GitHub fetch never resolves and there are no local clones to render in
 * the meantime — the "Loading projects…" spinner.
 */
export const Loading: Story = {
  render: () => {
    withMocks({ githubRepos: 'pending' });
    return <ProjectsListStory repositories={[]} />;
  },
};
