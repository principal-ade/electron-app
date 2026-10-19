import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import { buildHomeTabEntries, resolveRepoPath } from './homeTabEntries';

const purl = 'pkg:github/acme/app' as Purl;
const entry = {
  name: 'app',
  path: '/work/app',
  purl,
} as AlexandriaEntry;

function terminal(directory = '/work/app'): WorkspaceTab {
  return {
    id: 'terminal-1',
    label: 'Terminal',
    contentType: 'terminal',
    directory,
  };
}

function profile(): WorkspaceTab {
  return { id: 'profile', label: 'app', contentType: 'project-info', purl };
}

describe('buildHomeTabEntries', () => {
  it('nests repo-rooted tabs under their repo row', () => {
    const { repos, openTabs } = buildHomeTabEntries(
      [entry],
      [],
      [terminal('/work/app/src')],
      [],
    );

    expect(openTabs).toEqual([]);
    expect(repos).toHaveLength(1);
    expect(repos[0].openTabs).toEqual([
      expect.objectContaining({
        id: 'terminal-1',
        kind: 'terminal',
        path: '/work/app/src',
        repoPath: '/work/app',
      }),
    ]);
  });

  it('numbers terminal child rows by their position among terminals', () => {
    const second: WorkspaceTab = { ...terminal(), id: 'terminal-2' };
    const { repos } = buildHomeTabEntries(
      [entry],
      [],
      [terminal(), second],
      [],
    );
    expect(repos[0].openTabs.map((tab) => tab.label)).toEqual([
      'Tab 1',
      'Tab 2',
    ]);
  });

  it('puts standalone tabs in the top-level list', () => {
    const topic: WorkspaceTab = {
      id: 'local-topic-t1',
      label: 'Topic',
      contentType: 'local-topic',
      topicId: 't1',
      title: 'Topic',
    };
    const { repos, openTabs } = buildHomeTabEntries([], [], [topic], []);

    expect(repos).toEqual([]);
    expect(openTabs).toEqual([
      expect.objectContaining({ id: 'local-topic-t1', kind: 'topic' }),
    ]);
  });

  it('creates a repo row for a pinned tab whose repo has no open work', () => {
    const pin: HomePinnedTab = {
      id: 'profile',
      kind: 'repo-tab',
      label: 'app',
      repoPath: '/work/app',
      purl: String(purl),
      variant: 'project-info',
    };
    const { repos, pinnedTabs, openTabs } = buildHomeTabEntries(
      [entry],
      [],
      [],
      [pin],
    );

    expect(openTabs).toEqual([]);
    expect(pinnedTabs).toEqual([]);
    expect(repos).toHaveLength(1);
    expect(repos[0].pinnedTabs).toEqual([pin]);
  });

  it('does not double-list a pinned tab that is currently open', () => {
    const pin: HomePinnedTab = {
      id: 'profile',
      kind: 'repo-tab',
      label: 'app',
      repoPath: '/work/app',
      purl: String(purl),
      variant: 'project-info',
    };
    const { repos, pinnedTabs } = buildHomeTabEntries(
      [entry],
      [],
      [profile()],
      [pin],
    );

    expect(pinnedTabs).toEqual([]);
    expect(repos[0].openTabs.map((tab) => tab.id)).toEqual(['profile']);
    expect(repos[0].pinnedTabs).toEqual([]);
  });

  it('keeps a closed standalone pin in the Pinned section', () => {
    const pin: HomePinnedTab = {
      id: 'drawing-d1',
      kind: 'drawing',
      label: 'Sketch',
      drawingId: 'd1',
      path: '/home/.alexandria/drawings/d1.excalidraw',
      name: 'Sketch',
    };
    const { pinnedTabs } = buildHomeTabEntries([], [], [], [pin]);
    expect(pinnedTabs).toEqual([pin]);
  });

  it('ignores tabs the rail does not surface', () => {
    const landing: WorkspaceTab = {
      id: 'topics-home',
      label: 'Topics',
      contentType: 'topics-home',
    };
    const user: WorkspaceTab = {
      id: 'user-profile-octocat',
      label: '@octocat',
      contentType: 'user-profile',
      username: 'octocat',
    };
    const { repos, openTabs } = buildHomeTabEntries(
      [entry],
      [],
      [landing, user],
      [],
    );
    expect(repos).toEqual([]);
    expect(openTabs).toEqual([]);
  });

  it('nests a remote-only repo tab under a purl-keyed row', () => {
    const { repos } = buildHomeTabEntries([], [], [profile()], []);
    expect(repos).toHaveLength(1);
    expect(repos[0].key).toBe(purl);
    expect(repos[0].openTabs.map((tab) => tab.kind)).toEqual(['repo-tab']);
  });

  it('keeps a pinned repo in the list even when clean and tab-less', () => {
    const { repos } = buildHomeTabEntries([entry], [], [], [], ['/work/app']);
    expect(repos).toHaveLength(1);
    expect(repos[0].key).toBe('/work/app');
    expect(repos[0].pinned).toBe(true);
    expect(repos[0].openTabs).toEqual([]);
  });

  it('marks an already-listed repo as pinned', () => {
    const { repos } = buildHomeTabEntries(
      [entry],
      [],
      [terminal()],
      [],
      ['/work/app'],
    );
    expect(repos[0].pinned).toBe(true);
  });

  it('ignores individually pinned terminal entries', () => {
    const pin: HomePinnedTab = {
      id: 'terminal-1',
      kind: 'terminal',
      label: 'Terminal',
      path: '/work/app',
      repoPath: '/work/app',
    };
    const { repos, pinnedTabs } = buildHomeTabEntries([entry], [], [], [pin]);
    expect(repos).toEqual([]);
    expect(pinnedTabs).toEqual([]);
  });
});

describe('resolveRepoPath', () => {
  it('respects path boundaries and prefers the deepest clone', () => {
    const nested = { ...entry, path: '/work/app/nested' } as AlexandriaEntry;
    expect(resolveRepoPath('/work/app/nested/src', [entry, nested])).toBe(
      '/work/app/nested',
    );
    expect(resolveRepoPath('/work/app-other', [entry])).toBeUndefined();
    expect(resolveRepoPath('/work/app', [entry])).toBe('/work/app');
  });
});
