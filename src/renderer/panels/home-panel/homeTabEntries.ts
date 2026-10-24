/**
 * homeTabEntries
 *
 * Turns the open workspace tabs into the entries the Home left rail renders:
 *
 * - one child entry per **repo-rooted** tab (profile / file-city / doc /
 *   source / media / terminal whose path sits inside a registered clone),
 *   grouped under its repo row;
 * - one top-level entry per **standalone** tab (drawings, localhost browsers,
 *   skills, files outside any repo, and topics/models without a single-repo pin);
 * - pinned entries whose tab is currently closed, split the same way (repo
 *   rows carry them as icons, or labeled children for topics/models; the rest
 *   land in the Pinned section).
 * - requests in a separate target-metadata hierarchy, not their caller repo.
 *
 * The entry shape is the persisted `HomePinnedTab` descriptor, so a live entry
 * and a pinned one are the same value — the rail can pin an open tab without a
 * second representation.
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import type { ProcessEntry } from '../../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import {
  payloadFromLocalEntry,
  payloadFromPurl,
} from '../../events/repositorySelected';
import { getHomeRepositories, type HomeRepository } from './homeRepositories';
import type { InProgressRepo } from './useInProgressRepos';
import type { SavedRequest } from '../../../shared/requests/preparedRequest';
import { repoPurlFromEntry } from '../../../shared/topics/repoPurl';
import {
  buildRequestGroups,
  type RequestPurlGroup,
} from '../../requests/requestGroups';

/** A tab entry as the rail renders it (identical to the persisted shape). */
export type HomeTabEntry = HomePinnedTab;

/** Terminals and clone profiles are kept reachable by pinning their repo. */
export function isHomeTabPinnable(entry: HomeTabEntry): boolean {
  return (
    entry.kind !== 'terminal' &&
    !(entry.kind === 'repo-tab' && entry.variant === 'project-info')
  );
}

/** The browser represented by a repo process row, numbered in tab-bar order. */
export interface HomeProcessTab {
  id: string;
  number: number;
}

/** A repo row plus the tab entries nested under it. */
export interface HomeRepoRow extends HomeRepository {
  /** Active processes and saved launch configurations rooted in this repo. */
  processes: ProcessEntry[];
  /** Open repo-rooted tabs, rendered as child rows. */
  openTabs: HomeTabEntry[];
  /** Closed repo pins: labeled children for topics/models, icons otherwise. */
  pinnedTabs: HomeTabEntry[];
  /** Whether the user pinned this repo (keeps a clean, tab-less row visible). */
  pinned: boolean;
}

export interface HomeTabEntries {
  /** Open requests and remembered routes, grouped only by their optional target metadata. */
  requests: RequestPurlGroup[];
  /** Process id → its browser tab, already represented under a repository. */
  processTabs: Map<string, HomeProcessTab>;
  /** Active/pinned processes outside registered repositories. */
  processes: ProcessEntry[];
  /** Repos with in-progress work, an open tab, or a pinned tab. */
  repos: HomeRepoRow[];
  /** Open tabs that don't belong to any repo. */
  openTabs: HomeTabEntry[];
  /** Pinned entries with no open tab and no owning repo. */
  pinnedTabs: HomeTabEntry[];
}

/**
 * The repo clone path (or remote purl) a tab is rooted in, or null when the tab
 * isn't repo-scoped (topics, drawings, browsers, …).
 */
function ownerForTab(tab: WorkspaceTab): {
  path?: string;
  purl?: Purl;
} | null {
  switch (tab.contentType) {
    case 'project-info':
    case 'repo-explorer':
    case 'file-city-guide':
      return {
        path: tab.localEntry?.path ? String(tab.localEntry.path) : undefined,
        purl: tab.purl,
      };
    case 'terminal':
      return { path: tab.directory };
    case 'commit-review':
      return { path: tab.repoPath };
    case 'markdown-doc':
      return { path: tab.repositoryPath ?? tab.filePath };
    case 'http-request':
      return tab.repositoryPath ? { path: tab.repositoryPath } : null;
    case 'source-file':
    case 'media':
      return { path: tab.filePath };
    default:
      return null;
  }
}

/**
 * Convert a live tab to a rail entry, or null for tabs the rail doesn't surface
 * (`topics-home` landing, `commit-review` diffs, owner profiles).
 */
export function entryFromTab(
  tab: WorkspaceTab,
  repoPath?: string,
): HomeTabEntry | null {
  const base = { id: tab.id, label: tab.label, repoPath };
  switch (tab.contentType) {
    case 'http-request':
      return {
        ...base,
        kind: 'http-request',
        savedRequestId: tab.savedRequestId,
      };
    case 'local-topic':
      return { ...base, kind: 'topic', topicId: tab.topicId, title: tab.title };
    case 'markdown-doc':
      return {
        ...base,
        kind: 'markdown-doc',
        filePath: tab.filePath,
        repositoryPath: tab.repositoryPath,
      };
    case 'source-file':
      return { ...base, kind: 'source-file', filePath: tab.filePath };
    case 'media':
      return { ...base, kind: 'media', filePath: tab.filePath };
    case 'drawing':
      return {
        ...base,
        kind: 'drawing',
        drawingId: tab.drawingId,
        path: tab.path,
        name: tab.name,
      };
    case 'subsystem-model':
      return {
        ...base,
        kind: 'subsystem-model',
        modelId: tab.modelId,
        title: tab.label,
      };
    case 'skill':
      return { ...base, kind: 'skill' };
    case 'localhost-browser':
      return {
        ...base,
        kind: 'localhost-browser',
        port: tab.port,
        path: tab.path,
        processId: tab.processId,
      };
    case 'terminal':
      return { ...base, kind: 'terminal', path: tab.directory };
    case 'project-info':
    case 'repo-explorer':
    case 'file-city-guide':
      return {
        ...base,
        kind: 'repo-tab',
        purl: String(tab.purl),
        variant: tab.contentType,
      };
    default:
      return null;
  }
}

/**
 * Nearest registered clone containing `path` — the same boundary-safe
 * longest-prefix lookup `homeRepositories` uses, so a tab and its repo row
 * agree on ownership.
 */
export function resolveRepoPath(
  path: string,
  repositories: readonly AlexandriaEntry[],
): string | undefined {
  return repositories
    .filter(
      (repo) =>
        repo.path &&
        (path === String(repo.path) ||
          path.startsWith(String(repo.path).replace(/\/+$/, '') + '/')),
    )
    .sort((a, b) => String(b.path).length - String(a.path).length)[0]?.path as
    | string
    | undefined;
}

function findRepoByPath(
  path: string,
  repositories: readonly AlexandriaEntry[],
): AlexandriaEntry | undefined {
  return repositories.find((repo) => String(repo.path) === path);
}

/**
 * Build the Home rail's tab entries. Reuses {@link getHomeRepositories} for the
 * base row set (in-progress repos + repos owning an open tab) and then attaches
 * the entries, so a repo with only a pinned profile tab still gets a row.
 */
export function buildHomeTabEntries(
  repositories: AlexandriaEntry[],
  inProgress: InProgressRepo[],
  tabs: WorkspaceTab[],
  pinned: readonly HomePinnedTab[],
  pinnedRepos: readonly string[] = [],
  processes: readonly ProcessEntry[] = [],
  rememberedRequests: readonly SavedRequest[] = [],
  pinnedRepoScopes: ReadonlyMap<string, string> = new Map(),
): HomeTabEntries {
  const rows = new Map<string, HomeRepoRow>();
  const rowFor = (repo: HomeRepository): HomeRepoRow => {
    const existing = rows.get(repo.key);
    if (existing) return existing;
    const row: HomeRepoRow = {
      ...repo,
      openTabs: [],
      pinnedTabs: [],
      pinned: false,
      processes: [],
    };
    rows.set(repo.key, row);
    return row;
  };
  for (const repo of getHomeRepositories(
    repositories,
    inProgress,
    tabs.filter((tab) => tab.contentType !== 'http-request'),
  )) {
    rowFor(repo);
  }

  const scopedRow = (id: string): HomeRepoRow | undefined => {
    const purl = pinnedRepoScopes.get(id);
    if (!purl) return undefined;
    const repo = repositories.find(
      (entry) => repoPurlFromEntry(entry) === purl,
    );
    if (repo?.path) {
      const key = String(repo.path);
      return rowFor({
        key,
        payload: payloadFromLocalEntry({ ...repo, purl: purl as Purl }),
      });
    }
    return rowFor({ key: purl, payload: payloadFromPurl(purl as Purl) });
  };

  const standaloneProcesses: ProcessEntry[] = [];
  for (const process of processes) {
    // External processes have no managed output to inspect. Only surface
    // them in Home when there is a browser endpoint to open.
    if (process.origin === 'detected' && process.port == null) continue;
    const active = !['stopped', 'failed'].includes(process.status);
    if (!active && !process.pinned) continue;
    const repoPath = resolveRepoPath(process.cwd, repositories);
    const repoEntry = repoPath
      ? findRepoByPath(repoPath, repositories)
      : undefined;
    if (repoPath && repoEntry) {
      rowFor({
        key: repoPath,
        payload: payloadFromLocalEntry(repoEntry),
      }).processes.push(process);
    } else {
      standaloneProcesses.push(process);
    }
  }

  const openIds = new Set<string>();
  const openTabs: HomeTabEntry[] = [];
  const processTabs = new Map<string, HomeProcessTab>();
  const representedBrowserIds = new Set<string>();
  for (const row of rows.values()) {
    for (const process of row.processes) {
      // Managed browsers retain identity across port changes. Detected
      // processes open unlinked browsers, so match those by their current port.
      let index = tabs.findIndex(
        (tab) =>
          tab.contentType === 'localhost-browser' &&
          tab.processId === process.id,
      );
      if (index < 0 && !['stopped', 'failed'].includes(process.status)) {
        index = tabs.findIndex(
          (tab) =>
            tab.contentType === 'localhost-browser' &&
            !tab.processId &&
            process.port != null &&
            tab.port === process.port,
        );
      }
      const tab = tabs[index];
      if (!tab || representedBrowserIds.has(tab.id)) continue;
      processTabs.set(process.id, { id: tab.id, number: index + 1 });
      representedBrowserIds.add(tab.id);
    }
  }

  // Terminal tabs are labelled `⌘ N` by the tab host, where N is the tab's
  // overall position in the tab bar (Cmd+1–9 switches by overall index).
  // Mirror that numbering here so the rail says "Tab 1"/"Tab 3" instead of
  // repeating the repo name — and stays in sync when tabs are reordered.
  const terminalNumbers = new Map<string, number>();
  tabs.forEach((tab, index) => {
    if (tab.contentType === 'terminal') {
      terminalNumbers.set(tab.id, index + 1);
    }
  });

  for (const tab of tabs) {
    if (tab.contentType === 'http-request') continue;
    if (representedBrowserIds.has(tab.id)) {
      // Still count it as open so its persisted tab pin isn't duplicated.
      openIds.add(tab.id);
      continue;
    }
    const owner = ownerForTab(tab);
    // Prefer the clone containing the tab's path; a repo tab with no local
    // clone still nests under a registered repo matched by purl.
    const matchedEntry =
      !owner?.path && owner?.purl
        ? repositories.find(
            (repo) => (repo.purl ?? repo.github?.purl) === owner.purl,
          )
        : undefined;
    const repoPath = owner?.path
      ? resolveRepoPath(owner.path, repositories)
      : matchedEntry?.path
        ? String(matchedEntry.path)
        : undefined;
    const entry = entryFromTab(tab, repoPath);
    if (!entry) continue;
    if (entry.kind === 'terminal' && repoPath) {
      // Repo-nested terminals already sit under a row naming their location,
      // so the tab-bar position is the useful label there. A standalone
      // terminal has no repo row, so keep its cwd (the only thing that tells
      // two of them apart).
      const terminalNumber = terminalNumbers.get(tab.id);
      if (terminalNumber != null) entry.label = `Tab ${terminalNumber}`;
    }
    openIds.add(tab.id);

    const scope =
      entry.kind === 'topic' || entry.kind === 'subsystem-model'
        ? scopedRow(entry.id)
        : undefined;
    if (scope) {
      scope.openTabs.push(entry);
    } else if (repoPath) {
      const repoEntry = findRepoByPath(repoPath, repositories);
      const row =
        rows.get(repoPath) ??
        (repoEntry
          ? rowFor({ key: repoPath, payload: payloadFromLocalEntry(repoEntry) })
          : undefined);
      row?.openTabs.push(entry);
    } else if (owner?.purl) {
      const key = String(owner.purl);
      const row =
        rows.get(key) ?? rowFor({ key, payload: payloadFromPurl(owner.purl) });
      row.openTabs.push(entry);
    } else {
      openTabs.push(entry);
    }
  }

  // Pinned entries whose tab is closed (open ones already render as rows).
  // Ignore legacy individual terminal/profile pins; the repo is their shortcut.
  const pinnedTabs: HomeTabEntry[] = [];
  for (const pin of pinned) {
    if (pin.kind === 'http-request') continue;
    if (!isHomeTabPinnable(pin)) continue;
    if (openIds.has(pin.id)) continue;
    if (pin.kind === 'topic' || pin.kind === 'subsystem-model') {
      const row = scopedRow(pin.id);
      if (row) {
        row.pinnedTabs.push(pin);
        continue;
      }
      // The current scope wins over any legacy persisted repo metadata.
      pinnedTabs.push(pin);
      continue;
    }
    if (pin.repoPath) {
      const repoEntry = findRepoByPath(pin.repoPath, repositories);
      const row =
        rows.get(pin.repoPath) ??
        (repoEntry
          ? rowFor({
              key: pin.repoPath,
              payload: payloadFromLocalEntry(repoEntry),
            })
          : undefined);
      if (row) {
        row.pinnedTabs.push(pin);
        continue;
      }
    } else if (pin.purl) {
      const key = pin.purl;
      const purl = pin.purl as Purl;
      const row =
        rows.get(key) ?? rowFor({ key, payload: payloadFromPurl(purl) });
      row.pinnedTabs.push(pin);
      continue;
    }
    pinnedTabs.push(pin);
  }

  // Pinned repos stay in the rail even when they are clean and have no open
  // tabs. Resolve a row that isn't already present (the repo may not be
  // in-progress and may have no tabs).
  for (const key of pinnedRepos) {
    let row = rows.get(key);
    if (!row) {
      const localEntry = repositories.find((repo) => String(repo.path) === key);
      const byPurl = localEntry
        ? undefined
        : repositories.find((repo) => (repo.purl ?? repo.github?.purl) === key);
      const entry = localEntry ?? byPurl;
      if (entry?.path) {
        const path = String(entry.path);
        row =
          rows.get(path) ??
          rowFor({ key: path, payload: payloadFromLocalEntry(entry) });
      } else if (key.startsWith('pkg:')) {
        row = rowFor({ key, payload: payloadFromPurl(key as Purl) });
      }
    }
    if (row) row.pinned = true;
  }

  return {
    requests: buildRequestGroups(tabs, rememberedRequests),
    processTabs,
    processes: standaloneProcesses,
    repos: [...rows.values()],
    openTabs,
    pinnedTabs,
  };
}
