import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import { buildHomeTabEntries, resolveRepoPath } from './homeTabEntries';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';

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

  it('numbers terminal child rows by their overall tab-bar position', () => {
    const second: WorkspaceTab = { ...terminal(), id: 'terminal-2' };
    const { repos } = buildHomeTabEntries(
      [entry],
      [],
      [terminal(), profile(), second],
      [],
    );
    // The custom tab occupies position 2, so the second terminal is `⌘ 3`.
    expect(repos[0].openTabs.map((tab) => tab.label)).toEqual([
      'Tab 1',
      'app',
      'Tab 3',
    ]);
  });

  it('keeps a standalone terminal in Open Tabs with its cwd', () => {
    const { repos, openTabs } = buildHomeTabEntries(
      [],
      [],
      [terminal('/tmp/scratch')],
      [],
    );

    expect(repos).toEqual([]);
    expect(openTabs).toEqual([
      expect.objectContaining({
        id: 'terminal-1',
        kind: 'terminal',
        path: '/tmp/scratch',
        label: 'Terminal',
      }),
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
      id: 'explorer',
      kind: 'repo-tab',
      label: 'app',
      repoPath: '/work/app',
      purl: String(purl),
      variant: 'repo-explorer',
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

  it('ignores legacy remote-only profile pins', () => {
    const pin: HomePinnedTab = {
      id: 'profile',
      kind: 'repo-tab',
      label: 'app',
      purl: String(purl),
      variant: 'project-info',
    };
    const result = buildHomeTabEntries([], [], [], [pin]);
    expect(result.repos).toEqual([]);
    expect(result.pinnedTabs).toEqual([]);
  });

  it('shows a profile only while open, even with a legacy profile pin', () => {
    const pin: HomePinnedTab = {
      id: 'profile',
      kind: 'repo-tab',
      label: 'app',
      repoPath: '/work/app',
      purl: String(purl),
      variant: 'project-info',
    };
    const open = buildHomeTabEntries([entry], [], [profile()], [pin]);
    expect(open.repos[0].openTabs.map((tab) => tab.id)).toEqual([pin.id]);
    const closed = buildHomeTabEntries([entry], [], [], [pin]);
    expect(closed.repos).toEqual([]);
    const repoPinned = buildHomeTabEntries(
      [entry],
      [],
      [],
      [pin],
      ['/work/app'],
    );
    expect(repoPinned.repos).toHaveLength(1);
    expect(repoPinned.repos[0].pinned).toBe(true);
    expect(repoPinned.repos[0].pinnedTabs).toEqual([]);
    expect(repoPinned.repos[0].openTabs).toEqual([]);
    expect(buildHomeTabEntries([entry], [], [], []).repos).toEqual([]);
  });

  it('preserves compact icons for other closed repo pins', () => {
    const pin: HomePinnedTab = {
      id: 'explorer',
      kind: 'repo-tab',
      label: 'app',
      repoPath: '/work/app',
      purl: String(purl),
      variant: 'repo-explorer',
    };
    const result = buildHomeTabEntries([entry], [], [], [pin]);
    expect(result.repos[0].pinnedTabs).toEqual([pin]);
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

describe('Home processes', () => {
  const process: ProcessEntry = {
    id: 'managed-1',
    label: 'Dev server',
    command: 'npm run dev',
    cwd: '/work/app/src',
    kind: 'dev-server',
    origin: 'managed',
    status: 'running',
    startedAt: 1,
  };
  const browser: WorkspaceTab = {
    id: 'localhost-browser-process-managed-1',
    label: 'Dev server',
    contentType: 'localhost-browser',
    processId: process.id,
    port: 5173,
    path: '/dashboard',
  };

  it('represents a linked browser on its repo process row instead of Open Tabs', () => {
    const result = buildHomeTabEntries(
      [entry],
      [],
      [terminal(), browser],
      [],
      [],
      [process],
    );
    expect(result.openTabs).toEqual([]);
    expect(result.repos[0].openTabs.map((tab) => tab.id)).toEqual([
      'terminal-1',
    ]);
    expect(result.processTabs.get(process.id)).toEqual({
      id: browser.id,
      number: 2,
    });
  });

  it('matches a detected repo process to its browser by port', () => {
    const external = {
      ...process,
      id: 'detected:123',
      origin: 'detected' as const,
      port: 5173,
    };
    const unlinked = {
      ...browser,
      id: 'localhost-browser-5173',
      processId: undefined,
    };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [unlinked],
      [],
      [],
      [external],
    );
    expect(result.openTabs).toEqual([]);
    expect(result.processTabs.get(external.id)).toEqual({
      id: unlinked.id,
      number: 1,
    });
  });

  it('updates the process tab number when tabs are reordered or closed', () => {
    const build = (tabs: WorkspaceTab[]) =>
      buildHomeTabEntries([entry], [], tabs, [], [], [process]);
    expect(
      build([terminal(), profile(), browser]).processTabs.get(process.id)
        ?.number,
    ).toBe(3);
    expect(
      build([browser, terminal(), profile()]).processTabs.get(process.id)
        ?.number,
    ).toBe(1);
    expect(build([terminal()]).processTabs.size).toBe(0);
  });

  it('does not duplicate a suppressed browser as a closed pin', () => {
    const pin: HomePinnedTab = {
      id: browser.id,
      label: browser.label,
      kind: 'localhost-browser',
      port: 5173,
    };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [browser],
      [pin],
      [],
      [process],
    );
    expect(result.openTabs).toEqual([]);
    expect(result.pinnedTabs).toEqual([]);
  });

  it('keeps unrelated browsers and browsers without a repo process in Open Tabs', () => {
    const unrelated = {
      ...browser,
      id: 'unrelated',
      processId: 'other-process',
    };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [unrelated],
      [],
      [],
      [{ ...process, port: 5173 }],
    );
    expect(result.openTabs.map((tab) => tab.id)).toEqual(['unrelated']);
    expect(result.processTabs.size).toBe(0);
    const standalone = buildHomeTabEntries(
      [],
      [],
      [browser],
      [],
      [],
      [process],
    );
    expect(standalone.openTabs.map((tab) => tab.id)).toEqual([browser.id]);
  });

  it('prefers a managed browser identity over an unrelated unlinked tab on the same port', () => {
    const unlinked = {
      ...browser,
      id: 'localhost-browser-5173',
      processId: undefined,
    };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [unlinked, browser],
      [],
      [],
      [{ ...process, port: 5173 }],
    );
    expect(result.processTabs.get(process.id)).toEqual({
      id: browser.id,
      number: 2,
    });
    expect(result.openTabs.map((tab) => tab.id)).toEqual([unlinked.id]);
  });

  it('does not associate a stopped pin with an unlinked browser using its old port', () => {
    const unlinked = {
      ...browser,
      id: 'localhost-browser-5173',
      processId: undefined,
    };
    const stopped = {
      ...process,
      status: 'stopped' as const,
      pinned: true,
      port: 5173,
    };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [unlinked],
      [],
      [],
      [stopped],
    );
    expect(result.processTabs.size).toBe(0);
    expect(result.openTabs.map((tab) => tab.id)).toEqual([unlinked.id]);
  });

  it('creates a repository row for an active process without tabs or git changes', () => {
    const result = buildHomeTabEntries([entry], [], [], [], [], [process]);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].processes).toEqual([process]);
    expect(result.processes).toEqual([]);
  });

  it('keeps stopped pins visible but hides unpinned process history', () => {
    const pinned = { ...process, status: 'stopped' as const, pinned: true };
    const history = { ...process, id: 'history', status: 'failed' as const };
    const result = buildHomeTabEntries([], [], [], [], [], [pinned, history]);
    expect(result.processes).toEqual([pinned]);
  });

  it('shows active externally detected processes with a port', () => {
    const external = { ...process, origin: 'detected' as const, port: 5173 };
    const result = buildHomeTabEntries([entry], [], [], [], [], [external]);
    expect(result.repos[0].processes).toEqual([external]);
  });

  it('hides external processes without a port, inside and outside repositories', () => {
    const external = { ...process, origin: 'detected' as const };
    const outside = { ...external, id: 'outside', cwd: '/elsewhere' };
    const result = buildHomeTabEntries(
      [entry],
      [],
      [],
      [],
      [],
      [external, outside],
    );
    expect(result.repos).toEqual([]);
    expect(result.processes).toEqual([]);
  });

  it('keeps active managed processes without a port visible outside repositories', () => {
    const result = buildHomeTabEntries([], [], [], [], [], [process]);
    expect(result.processes).toEqual([process]);
  });

  it('uses the deepest registered clone and respects path boundaries', () => {
    const nested = { ...entry, path: '/work/app/src' } as AlexandriaEntry;
    const outside = { ...process, id: 'outside', cwd: '/work/app-other' };
    const result = buildHomeTabEntries(
      [entry, nested],
      [],
      [],
      [],
      [],
      [process, outside],
    );
    expect(result.repos[0].key).toBe('/work/app/src');
    expect(result.processes).toEqual([outside]);
  });
});
