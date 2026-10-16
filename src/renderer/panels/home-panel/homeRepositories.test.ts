import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import { getHomeRepositories } from './homeRepositories';

const purl = 'pkg:github/acme/app' as Purl;
const entry = {
  name: 'app',
  path: '/work/app',
  purl,
} as AlexandriaEntry;

const cleanStatus: GitStatusWithFiles = {
  repoPath: String(entry.path),
  branch: 'main',
  isDirty: false,
  hasUntracked: false,
  hasStaged: false,
  ahead: 0,
  behind: 0,
  watchingEnabled: false,
  modifiedFiles: [],
  untrackedFiles: [],
  stagedFiles: [],
  createdFiles: [],
  deletedFiles: [],
  hash: 'clean',
};

function terminal(directory = '/work/app'): WorkspaceTab {
  return {
    id: directory,
    label: 'Terminal',
    contentType: 'terminal',
    directory,
  };
}

function profile(): WorkspaceTab {
  return { id: 'profile', label: 'app', contentType: 'project-info', purl };
}

describe('getHomeRepositories', () => {
  it('includes a clean repository with an open profile tab', () => {
    expect(getHomeRepositories([entry], [], [profile()])).toEqual([
      {
        key: '/work/app',
        payload: expect.objectContaining({ purl, localEntry: entry }),
      },
    ]);
  });

  it('includes a repository for a terminal in a subdirectory', () => {
    expect(
      getHomeRepositories([entry], [], [terminal('/work/app/src')]),
    ).toHaveLength(1);
  });

  it('matches the deepest repository without matching sibling path prefixes', () => {
    const nested = { ...entry, path: '/work/app/nested' } as AlexandriaEntry;
    const rows = getHomeRepositories(
      [entry, nested],
      [],
      [terminal('/work/app/nested/src'), terminal('/work/app-other')],
    );
    expect(rows.map((row) => row.key)).toEqual(['/work/app/nested']);
  });

  it('deduplicates multiple tabs and retains in-progress status', () => {
    const status = {
      ...cleanStatus,
      isDirty: true,
      ahead: 2,
    };
    const rows = getHomeRepositories(
      [entry],
      [{ entry, status }],
      [profile(), terminal()],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(status);
  });

  it('removes clean repositories when the last associated tab closes', () => {
    expect(getHomeRepositories([entry], [], [terminal()])).toHaveLength(1);
    expect(getHomeRepositories([entry], [], [])).toEqual([]);
  });

  it('keeps repositories with unpushed commits after tabs close', () => {
    const status = {
      ...cleanStatus,
      ahead: 1,
    };
    expect(getHomeRepositories([entry], [{ entry, status }], [])).toHaveLength(
      1,
    );
  });

  it('includes remote-only repositories without inventing a local clone', () => {
    const rows = getHomeRepositories([], [], [profile()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe(purl);
    expect(rows[0].payload.github?.owner).toBe('acme');
    expect(rows[0].payload.localEntry).toBeUndefined();
  });

  it.each(['repo-explorer', 'file-city-guide'] as const)(
    'includes repositories with an open %s tab',
    (contentType) => {
      const tab: WorkspaceTab = {
        id: 'repo',
        label: 'app',
        contentType,
        purl,
        localEntry: entry,
      };
      expect(getHomeRepositories([entry], [], [tab])).toHaveLength(1);
    },
  );

  it.each(['markdown-doc', 'source-file', 'media'] as const)(
    'includes repositories containing an open %s',
    (contentType) => {
      const tab: WorkspaceTab = {
        id: 'file',
        label: 'File',
        contentType,
        filePath: '/work/app/README.md',
      };
      expect(getHomeRepositories([entry], [], [tab])).toHaveLength(1);
    },
  );

  it('ignores tabs that do not belong to a repository', () => {
    const tab: WorkspaceTab = {
      id: 'topic',
      label: 'Topic',
      contentType: 'local-topic',
      topicId: 'topic',
    };
    expect(getHomeRepositories([entry], [], [tab])).toEqual([]);
  });
});
