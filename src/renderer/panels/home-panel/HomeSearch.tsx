/**
 * HomeSearch
 *
 * The Home panel's search bar and result list. Searches across three sources —
 * "Your Projects" (GitHub repos the user owns / their orgs), local clones
 * (Alexandria entries), and starred repos — merging results by full_name /
 * path so a repo that is, say, both owned and cloned shows up once with both
 * tags.
 *
 * `HomeSearchBar` is always rendered (first thing under the In Progress line).
 * `HomeSearchResults` renders only while the query is non-empty; the caller
 * shows the in-progress repo list instead when the query is empty.
 */

import React, { useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, HardDrive, Search, Star, X } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';

/**
 * A grouped set of GitHub repos (the user's own + one per org). Built by
 * HomeLeftPanel and flattened by the search below.
 */
export interface ProjectSection {
  key: string;
  label: string;
  avatar_url?: string;
  repos: GitHubRepository[];
}

type SearchKind = 'project' | 'clone' | 'starred';

interface SearchItem {
  key: string;
  name: string;
  subtitle: string;
  description?: string | null;
  kinds: SearchKind[];
  /** Present for GitHub-backed results (projects + starred). */
  repo?: GitHubRepository;
  /** Present for local clones. */
  entry?: AlexandriaEntry;
}

function basename(path: string | undefined | null): string | null {
  if (!path) return null;
  const parts = String(path).replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || null;
}

/** Merge the three sources into one deduped, sorted list. */
export function buildSearchItems(
  projectSections: ProjectSection[] | null,
  repositories: AlexandriaEntry[],
  starredRepos: GitHubRepository[] | null,
): SearchItem[] {
  const map = new Map<string, SearchItem>();

  const addRepo = (repo: GitHubRepository, kind: SearchKind) => {
    const key = repo.full_name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
      if (!existing.repo) existing.repo = repo;
      return;
    }
    const [, name] = repo.full_name.split('/');
    map.set(key, {
      key,
      name: name || repo.name,
      subtitle: repo.full_name,
      description: repo.description,
      kinds: [kind],
      repo,
    });
  };

  for (const section of projectSections ?? []) {
    for (const repo of section.repos) addRepo(repo, 'project');
  }
  for (const repo of starredRepos ?? []) addRepo(repo, 'starred');

  for (const entry of repositories) {
    const owner = entry.github?.owner;
    const name =
      entry.github?.name || entry.name || basename(entry.path) || 'Unknown';
    if (owner && name) {
      const key = `${owner}/${name}`.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (!existing.kinds.includes('clone')) existing.kinds.push('clone');
        existing.entry = entry;
        continue;
      }
      map.set(key, {
        key,
        name,
        subtitle: `${owner}/${name}`,
        description: entry.github?.description,
        kinds: ['clone'],
        entry,
      });
    } else {
      const path = String(entry.path ?? '');
      map.set(`path:${path.toLowerCase()}`, {
        key: `path:${path.toLowerCase()}`,
        name,
        subtitle: path || 'Local clone',
        kinds: ['clone'],
        entry,
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

export interface HomeSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onFocus?: () => void;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  query,
  onQueryChange,
  onFocus,
}) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <Search
        size={14}
        style={{ color: theme.colors.textMuted, flexShrink: 0 }}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Search projects, clones, starred"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          outline: 'none',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          border: 'none',
        }}
      />
      {query.length > 0 && (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          aria-label="Clear search"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2,
            border: 'none',
            background: 'transparent',
            color: theme.colors.textMuted,
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface HomeSearchResultsProps {
  query: string;
  projectSections: ProjectSection[] | null;
  repositories: AlexandriaEntry[];
  starredRepos: GitHubRepository[] | null;
  onSelectRepo: (repo: GitHubRepository) => void;
  onSelectEntry: (entry: AlexandriaEntry) => void;
}

const KIND_META: Record<SearchKind, { label: string; icon: React.ReactNode }> =
  {
    project: { label: 'Project', icon: <FolderGit2 size={11} /> },
    clone: { label: 'Clone', icon: <HardDrive size={11} /> },
    starred: { label: 'Starred', icon: <Star size={11} /> },
  };

export const HomeSearchResults: React.FC<HomeSearchResultsProps> = ({
  query,
  projectSections,
  repositories,
  starredRepos,
  onSelectRepo,
  onSelectEntry,
}) => {
  const { theme } = useTheme();

  const results = useMemo(() => {
    const items = buildSearchItems(projectSections, repositories, starredRepos);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.subtitle.toLowerCase().includes(q) ||
        (it.description?.toLowerCase().includes(q) ?? false),
    );
  }, [projectSections, repositories, starredRepos, query]);

  if (results.length === 0) {
    return (
      <div
        style={{
          padding: '24px 16px',
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes[1],
          lineHeight: 1.5,
        }}
      >
        No matches for &quot;{query.trim()}&quot;.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }}>
      {results.map((item) => (
        <ResultRow
          key={item.key}
          item={item}
          onSelect={() => {
            if (item.repo) onSelectRepo(item.repo);
            else if (item.entry) onSelectEntry(item.entry);
          }}
        />
      ))}
    </div>
  );
};

function ResultRow({
  item,
  onSelect,
}: {
  item: SearchItem;
  onSelect: () => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: '8px 10px',
        background: hovered
          ? `color-mix(in srgb, ${theme.colors.primary} 6%, ${theme.colors.background})`
          : 'transparent',
        color: theme.colors.text,
        cursor: 'pointer',
        display: 'block',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        <span
          style={{
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </span>
        {item.kinds.map((kind) => (
          <KindTag key={kind} kind={kind} />
        ))}
      </div>
      <div
        style={{
          marginTop: 2,
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes[0],
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.subtitle}
      </div>
    </button>
  );
}

function KindTag({ kind }: { kind: SearchKind }) {
  const { theme } = useTheme();
  const meta = KIND_META[kind];
  return (
    <span
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 6px',
        borderRadius: 999,
        border: `1px solid ${theme.colors.border}`,
        color: theme.colors.textMuted,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        lineHeight: 1.4,
      }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}
