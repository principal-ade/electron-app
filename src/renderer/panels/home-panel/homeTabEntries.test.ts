import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type {
  AgentSessionBookmark,
  HomePinnedTab,
} from '../../../shared/types/userPreferences.types';
import { agentSessionBookmarkTabId } from '../../../shared/agentSessionBookmark';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import type { TerminalTab } from '../../events/portalTabs';
import {
  buildHomeTabEntries,
  entryFromTab,
  resolveRepoPath,
} from './homeTabEntries';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { HttpRequestTab } from '../../events/portalTabs';

const purl = 'pkg:github/acme/app' as Purl;
const entry = {
  name: 'app',
  path: '/work/app',
  purl,
} as AlexandriaEntry;

test('groups bookmarked sessions under the closest registered repository', () => {
  const nestedRepo = {
    name: 'nested',
    path: '/work/app/packages/nested',
    purl: 'pkg:github/acme/nested',
  } as AlexandriaEntry;
  const bookmark: AgentSessionBookmark = {
    id: 'claude-1',
    title: 'Fix nested package',
    directory: '/work/app/packages/nested/src',
    agent: 'Claude Code',
  };

  const result = buildHomeTabEntries(
    [entry, nestedRepo],
    [],
    [],
    [],
    [],
    [],
    [],
    new Map(),
    [],
    [bookmark],
  );

  expect(result.repos).toHaveLength(1);
  expect(result.repos[0].key).toBe('/work/app/packages/nested');
  expect(result.repos[0].sessionBookmarks).toEqual([bookmark]);
  expect(result.pinnedSessionBookmarks).toBeUndefined();
});

test('keeps a bookmarked session in Pinned when no registered repo matches', () => {
  const bookmark: AgentSessionBookmark = {
    id: 'cursor-1',
    title: 'Update the docs',
    directory: '/work/elsewhere',
    agent: 'Cursor',
  };

  const result = buildHomeTabEntries(
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    new Map(),
    [],
    [bookmark],
  );

  expect(result.pinnedSessionBookmarks).toEqual([bookmark]);
});

test('represents an open bookmarked session by its terminal tab only', () => {
  const bookmark: AgentSessionBookmark = {
    id: 'claude-2',
    title: 'Fix the tab association',
    directory: '/work/app',
    agent: 'Claude Code',
  };
  const terminalTab = {
    ...terminal(bookmark.directory),
    id: agentSessionBookmarkTabId(bookmark),
    agent: 'claude',
  };

  const result = buildHomeTabEntries(
    [entry],
    [],
    [terminalTab],
    [],
    [],
    [],
    [],
    new Map(),
    [],
    [bookmark],
  );

  expect(result.repos[0].openTabs).toHaveLength(1);
  expect(result.repos[0].openTabs[0]).toMatchObject({
    id: agentSessionBookmarkTabId(bookmark),
    kind: 'terminal',
    agent: 'claude',
  });
  expect(result.repos[0].sessionBookmarks).toBeUndefined();
  expect(result.pinnedSessionBookmarks).toBeUndefined();
});

test('requests appear only in target groups, never under the originating repo, without payloads', () => {
  const request: HttpRequestTab = {
    id: 'http-request-one',
    label: 'Health',
    contentType: 'http-request',
    savedRequestId: 'one',
    sessionId: 'session',
    panelState: {
      request: {
        http: { method: 'GET', url: 'https://private.test?token=secret' },
      },
      requestId: 'one',
      environment: { TOKEN: 'secret' },
      environmentName: null,
      response: null,
      error: null,
      isSending: false,
    },
  };
  const standalone = buildHomeTabEntries([], [], [request], []);
  expect(standalone.openTabs).toEqual([]);
  expect(standalone.requests[0].identifiers[0].requests).toEqual([
    {
      id: request.id,
      label: 'Health',
      savedRequestId: 'one',
      open: true,
    },
  ]);
  expect(JSON.stringify(standalone)).not.toContain('secret');
  const grouped = buildHomeTabEntries(
    [entry],
    [],
    [{ ...request, repositoryPath: '/work/app' }],
    [],
  );
  expect(grouped.repos).toEqual([]);
  expect(grouped.requests).toEqual(standalone.requests);
  const pin: HomePinnedTab = {
    id: request.id,
    kind: 'http-request',
    label: 'Health',
    savedRequestId: 'one',
    repoPath: '/work/app',
  };
  const definition = request.panelState.request;
  if (!definition) throw new Error('Missing prepared request.');
  const saved = {
    id: 'one',
    title: 'Health',
    request: definition,
    environment: {},
    repositoryPath: '/work/app',
    target: {
      purl: 'pkg:github/unregistered/target',
      identifier: 'container:api',
    },
  };
  const closed = buildHomeTabEntries([entry], [], [], [pin], [], [], [saved]);
  expect(closed.repos).toEqual([]);
  expect(closed.pinnedTabs).toEqual([]);
  expect(closed.requests[0]).toMatchObject({
    purl: saved.target.purl,
    identifiers: [
      {
        identifier: saved.target.identifier,
        requests: [expect.objectContaining({ open: false })],
      },
    ],
  });
  const open = buildHomeTabEntries(
    [entry],
    [],
    [request],
    [pin],
    [],
    [],
    [saved],
  );
  expect(open.requests[0].purl).toBeUndefined();
  expect(open.requests[0].identifiers[0].requests).toHaveLength(1);
  expect(open.requests[0].identifiers[0].requests[0].open).toBe(true);
});

function terminal(directory = '/work/app'): TerminalTab {
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
  const scopedPins: HomePinnedTab[] = [
    { id: 'local-topic-t1', kind: 'topic', label: 'Topic', topicId: 't1' },
    {
      id: 'subsystem-model-m1',
      kind: 'subsystem-model',
      label: 'Model',
      modelId: 'm1',
    },
  ];

  it.each(scopedPins)(
    'shows the unpinned repo for a closed $kind pin',
    (pin) => {
      const result = buildHomeTabEntries(
        [entry],
        [],
        [],
        [pin],
        [],
        [],
        [],
        new Map([[pin.id, purl]]),
      );
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0]).toMatchObject({
        key: entry.path,
        pinned: false,
        pinnedTabs: [pin],
        openTabs: [],
      });
      expect(result.pinnedTabs).toEqual([]);
      expect(buildHomeTabEntries([entry], [], [], []).repos).toEqual([]);
    },
  );
  it.each(scopedPins)(
    'treats a $kind open in its own window as open, not as a closed pin',
    (pin) => {
      const standalone = buildHomeTabEntries(
        [],
        [],
        [],
        [pin],
        [],
        [],
        [],
        new Map(),
        [pin],
      );
      expect(standalone.openTabs).toEqual([pin]);
      expect(standalone.pinnedTabs).toEqual([]);

      const scoped = buildHomeTabEntries(
        [entry],
        [],
        [],
        [pin],
        [],
        [],
        [],
        new Map([[pin.id, purl]]),
        [pin],
      );
      expect(scoped.repos[0]).toMatchObject({
        openTabs: [pin],
        pinnedTabs: [],
      });
    },
  );

  it('prefers the tab in this window when a detached copy is also listed', () => {
    const tab: WorkspaceTab = {
      id: 'local-topic-t1',
      label: 'Topic',
      contentType: 'local-topic',
      topicId: 't1',
      title: 'Topic',
    } as WorkspaceTab;
    const result = buildHomeTabEntries(
      [],
      [],
      [tab],
      [],
      [],
      [],
      [],
      new Map(),
      [scopedPins[0]],
    );
    expect(result.openTabs).toHaveLength(1);
  });

  it('shows a remote-only repo for a scoped pin without a registered clone', () => {
    const pin = scopedPins[0];
    const result = buildHomeTabEntries(
      [],
      [],
      [],
      [pin],
      [],
      [],
      [],
      new Map([[pin.id, purl]]),
    );
    expect(result.repos[0]).toMatchObject({
      key: purl,
      pinned: false,
      pinnedTabs: [pin],
    });
    expect(result.repos[0].payload.github?.name).toBe('app');
  });

  it('nests open scoped pins once under the same repo', () => {
    const tabs: WorkspaceTab[] = [
      {
        id: scopedPins[0].id,
        label: 'Topic',
        contentType: 'local-topic',
        topicId: 't1',
      },
      {
        id: scopedPins[1].id,
        label: 'Model',
        contentType: 'subsystem-model',
        modelId: 'm1',
      },
    ];
    const result = buildHomeTabEntries(
      [entry],
      [],
      tabs,
      scopedPins,
      [],
      [],
      [],
      new Map(scopedPins.map((pin) => [pin.id, purl])),
    );
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].openTabs.map((tab) => tab.id)).toEqual(
      tabs.map((tab) => tab.id),
    );
    expect(result.repos[0].pinnedTabs).toEqual([]);
    expect(result.openTabs).toEqual([]);
    expect(result.pinnedTabs).toEqual([]);
  });

  it('keeps unscoped and multi-repo pins standalone, ignoring old repo metadata', () => {
    const pins = scopedPins.map((pin) => ({
      ...pin,
      purl,
      repoPath: '/work/app',
    }));
    const result = buildHomeTabEntries([entry], [], [], pins);
    expect(result.repos).toEqual([]);
    expect(result.pinnedTabs).toEqual(pins);
  });

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

  it('preserves a host-assigned terminal custom label instead of numbering it', () => {
    const named: TerminalTab = {
      ...terminal(),
      label: 'Fix login',
      customLabel: 'Fix login',
      agent: 'opencode',
    };
    const { repos } = buildHomeTabEntries([entry], [], [named], []);

    expect(repos[0].openTabs[0]).toMatchObject({
      label: 'Fix login',
      customLabel: 'Fix login',
      agent: 'opencode',
    });
  });

  it('keeps a resumed agent session name instead of numbering it', () => {
    const session: TerminalTab = {
      ...terminal(),
      label: 'Claude Code · Fix the login flow',
      agent: 'claude',
    };
    const { repos } = buildHomeTabEntries([entry], [], [session], []);

    expect(repos[0].openTabs[0]).toMatchObject({
      label: 'Claude Code · Fix the login flow',
      agent: 'claude',
    });
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

  it('nests an open build configuration under its repository and reopens a closed pin', () => {
    const buildTab: WorkspaceTab = {
      id: 'build-configuration-bc-1',
      label: 'mac publish',
      contentType: 'build-configuration',
      configId: 'bc-1',
      repo: String(purl),
    };
    const open = buildHomeTabEntries([entry], [], [buildTab], []);
    expect(open.repos).toHaveLength(1);
    const entryUnderRepo = open.repos[0].openTabs[0];
    expect(entryUnderRepo).toMatchObject({
      id: buildTab.id,
      kind: 'build-configuration',
      configId: 'bc-1',
      repoPath: '/work/app',
      purl: String(purl),
    });

    const closed = buildHomeTabEntries([entry], [], [], [entryUnderRepo]);
    expect(closed.repos[0].pinnedTabs).toEqual([entryUnderRepo]);
  });
});

describe('tab renames (customLabel)', () => {
  it('keeps spec tabs pinnable with their file and repository paths', () => {
    const specTab = {
      id: 'spec-/work/app/openspec/specs/cli-list/spec.md',
      label: 'cli-list',
      contentType: 'spec',
      filePath: '/work/app/openspec/specs/cli-list/spec.md',
      repositoryPath: '/work/app',
    } as WorkspaceTab;

    expect(entryFromTab(specTab)).toMatchObject({
      id: specTab.id,
      kind: 'spec',
      filePath: '/work/app/openspec/specs/cli-list/spec.md',
      repositoryPath: '/work/app',
    });
  });

  it('prefers the rename for the entry label and preserves it for reopen', () => {
    const tab = {
      id: 'local-topic-t1',
      label: 'Topic',
      contentType: 'local-topic',
      topicId: 't1',
      customLabel: '  My focus  ',
    } as WorkspaceTab;
    expect(entryFromTab(tab)).toMatchObject({
      id: tab.id,
      label: 'My focus',
      customLabel: 'My focus',
    });
  });

  it('omits customLabel when unset or whitespace-only', () => {
    const plain = {
      id: 'local-topic-t1',
      label: 'Topic',
      contentType: 'local-topic',
      topicId: 't1',
    } as WorkspaceTab;
    expect(entryFromTab(plain)).toMatchObject({ label: 'Topic' });
    expect(entryFromTab(plain)).not.toHaveProperty('customLabel');

    const blank = { ...plain, customLabel: '   ' };
    expect(entryFromTab(blank)).toMatchObject({ label: 'Topic' });
    expect(entryFromTab(blank)).not.toHaveProperty('customLabel');
  });

  it('lists an open bot chat under bots, not the generic open tabs', () => {
    const botTab = {
      id: 'openbot-chat-agent-1',
      label: 'Atlas',
      contentType: 'openbot-chat',
      agentId: 'agent-1',
      botName: 'Atlas',
    } as WorkspaceTab;

    const result = buildHomeTabEntries([], [], [botTab], []);

    expect(result.bots).toMatchObject([
      { id: botTab.id, kind: 'openbot-chat', label: 'Atlas' },
    ]);
    expect(result.openTabs).toEqual([]);
  });

  it('keeps a renamed repo-nested terminal name instead of Tab N', () => {
    const terminal = {
      id: 'tab-1',
      label: 'app',
      contentType: 'terminal',
      directory: '/work/app',
      customLabel: 'api server',
    } as WorkspaceTab;
    const result = buildHomeTabEntries([entry], [], [terminal], []);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].openTabs[0]).toMatchObject({
      id: 'tab-1',
      kind: 'terminal',
      label: 'api server',
      customLabel: 'api server',
    });
  });
});
