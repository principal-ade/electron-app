/**
 * homeTabEntries
 *
 * Turns the open workspace tabs into the entries the Home left rail renders:
 *
 * - one child entry per **repo-rooted** tab (profile / file-city / doc /
 *   source / media / terminal whose path sits inside a registered clone),
 *   grouped under its repo row;
 * - one top-level entry per **standalone** tab (topics, drawings, subsystem
 *   models, localhost browsers, skills, and files outside any repo);
 * - pinned entries whose tab is currently closed, split the same way (repo
 *   rows carry them as icons; the rest land in the Pinned section).
 *
 * The entry shape is the persisted `HomePinnedTab` descriptor, so a live entry
 * and a pinned one are the same value — the rail can pin an open tab without a
 * second representation.
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { Purl } from '@principal-ai/alexandria-core-library';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import {
  payloadFromLocalEntry,
  payloadFromPurl,
} from '../../events/repositorySelected';
import { getHomeRepositories, type HomeRepository } from './homeRepositories';
import type { InProgressRepo } from './useInProgressRepos';

/** A tab entry as the rail renders it (identical to the persisted shape). */
export type HomeTabEntry = HomePinnedTab;

/** A repo row plus the tab entries nested under it. */
export interface HomeRepoRow extends HomeRepository {
  /** Open repo-rooted tabs, rendered as child rows. */
  openTabs: HomeTabEntry[];
  /** Pinned repo-rooted tabs whose tab is closed, rendered as row icons. */
  pinnedTabs: HomeTabEntry[];
  /** Whether the user pinned this repo (keeps a clean, tab-less row visible). */
  pinned: boolean;
}

export interface HomeTabEntries {
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
    };
    rows.set(repo.key, row);
    return row;
  };
  for (const repo of getHomeRepositories(repositories, inProgress, tabs)) {
    rowFor(repo);
  }

  const openIds = new Set<string>();
  const openTabs: HomeTabEntry[] = [];

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
    if (entry.kind === 'terminal') {
      const terminalNumber = terminalNumbers.get(tab.id);
      if (terminalNumber != null) entry.label = `Tab ${terminalNumber}`;
    }
    openIds.add(tab.id);

    if (repoPath) {
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
  // Terminals are pinned by pinning their repo, never individually.
  const pinnedTabs: HomeTabEntry[] = [];
  for (const pin of pinned) {
    if (pin.kind === 'terminal') continue;
    if (openIds.has(pin.id)) continue;
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
    repos: [...rows.values()],
    openTabs,
    pinnedTabs,
  };
}
