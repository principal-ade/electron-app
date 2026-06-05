import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { GitStatusEntry } from '@pierre/trees';
import type {
  PanelActions,
  PanelContextValue,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type {
  FileTree as RepoFileTree,
  GitStatusWithFiles,
} from '@principal-ai/repository-abstraction';

interface AlexandriaFilesPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  gitStatusWithFiles?: DataSlice<GitStatusWithFiles | null>;
}

export interface AlexandriaFilesPanelProps {
  context: AlexandriaFilesPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

type FileFilter = 'all' | 'touched';

/**
 * A slimmed-down file tree for the Alexandria workspace. Unlike the dev
 * workspace's FilesPanel it carries no scopes tab, audit/coverage filter,
 * drag host, or add-to-scope modal — it just renders the repository file
 * tree and offers a single toggle to narrow the tree to the files that
 * have been "touched" (have uncommitted git changes).
 */
export const AlexandriaFilesPanel: React.FC<AlexandriaFilesPanelProps> = ({
  context,
  events,
}) => {
  const { theme } = useTheme();
  const tree = context.fileTree?.data ?? null;
  const rootPath = tree?.metadata?.id ?? '';

  const allPaths = React.useMemo<string[]>(() => {
    if (!tree) return [];
    return tree.allFiles.map((f) => f.path).sort();
  }, [tree]);

  // Repo-relative paths of files with uncommitted git changes. A file is
  // "touched" if git reports it as modified, staged, created, or untracked.
  // Deleted files are intentionally excluded — they no longer exist in the
  // tree, so filtering to them would yield an empty view. Git reports
  // repo-relative paths; we match those against each tree node's relativePath
  // (also repo-relative) rather than gambling on a rootPath prefix lining up
  // with the tree's absolute `path` strings.
  const touchedRelative = React.useMemo<Set<string>>(() => {
    const status = context.gitStatusWithFiles?.data;
    if (!status) return new Set();
    const set = new Set<string>();
    for (const p of status.modifiedFiles) set.add(p);
    for (const p of status.stagedFiles) set.add(p);
    for (const p of status.createdFiles) set.add(p);
    for (const p of status.untrackedFiles) set.add(p);
    return set;
  }, [context.gitStatusWithFiles?.data]);

  // The tree-node `path` strings (what useFileTree keys on) for touched files.
  // Resolved by joining git's relative paths to tree nodes via relativePath.
  const touchedTreePaths = React.useMemo<string[]>(() => {
    if (!tree || touchedRelative.size === 0) return [];
    return tree.allFiles
      .filter((f) => touchedRelative.has(f.relativePath))
      .map((f) => f.path);
  }, [tree, touchedRelative]);

  const [filter, setFilter] = React.useState<FileFilter>('all');

  // The "Touched" filter is meaningless with no matches; fall back to "all"
  // so the toggle can never strand the user on an empty tree.
  const effectiveFilter: FileFilter =
    touchedTreePaths.length === 0 ? 'all' : filter;

  const filteredPaths = React.useMemo<string[]>(() => {
    const base = effectiveFilter === 'touched' ? touchedTreePaths : allPaths;
    // @pierre/trees' Builder rejects consecutive duplicate paths; FS-watcher
    // batches can coalesce a delete+add for the same path and leak a duplicate
    // into tree.allFiles, so dedupe before resetPaths can crash on it.
    return Array.from(new Set(base)).sort();
  }, [effectiveFilter, allPaths, touchedTreePaths]);

  const initialExpandedPaths = React.useMemo<string[]>(
    () => (rootPath ? [rootPath] : []),
    [rootPath],
  );

  const gitStatusEntries = React.useMemo<GitStatusEntry[]>(
    () => buildGitStatusEntries(tree, context.gitStatusWithFiles?.data),
    [tree, context.gitStatusWithFiles?.data],
  );

  const modelRef = React.useRef<ReturnType<typeof useFileTree>['model'] | null>(
    null,
  );
  const { model } = useFileTree({
    paths: filteredPaths,
    search: true,
    initialExpandedPaths,
    gitStatus: gitStatusEntries,
    onSelectionChange: (selected) => {
      const next = selected[0] ?? null;
      if (!next) return;
      const item = modelRef.current?.getItem(next);
      if (item && item.isDirectory()) return;
      events.emit({
        type: 'file:open',
        source: 'alexandria-files-panel',
        timestamp: Date.now(),
        payload: { path: stripRoot(next, rootPath) },
      });
    },
  });
  modelRef.current = model;

  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(filteredPaths, { initialExpandedPaths });
  }, [model, filteredPaths, initialExpandedPaths]);

  // useFileTree() builds the model once and ignores later option changes, so
  // the gitStatus captured at first render (empty, since git status loads
  // async) would stick forever. Push updates through the model's imperative
  // setter whenever the resolved entries change.
  React.useEffect(() => {
    model.setGitStatus(gitStatusEntries);
  }, [model, gitStatusEntries]);

  if (!tree) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: theme.colors.background,
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts.body,
        }}
      >
        No file tree available
      </div>
    );
  }

  const hasTouched = touchedTreePaths.length > 0;
  const FILTERS: { id: FileFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All files', count: allPaths.length },
    { id: 'touched', label: 'Touched', count: touchedTreePaths.length },
  ];

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
        }}
      >
        <div
          style={{
            display: 'flex',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 4,
            overflow: 'hidden',
            fontSize: 12,
            flex: 1,
          }}
        >
          {FILTERS.map(({ id, label, count }, i) => {
            const active = effectiveFilter === id;
            const disabled = id === 'touched' && !hasTouched;
            return (
              <button
                key={id}
                onClick={() => !disabled && setFilter(id)}
                disabled={disabled}
                title={
                  disabled ? 'No files with uncommitted changes' : undefined
                }
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  background: active ? theme.colors.primary : 'transparent',
                  border: 'none',
                  borderLeft:
                    i === 0 ? 'none' : `1px solid ${theme.colors.border}`,
                  color: active
                    ? '#ffffff'
                    : disabled
                      ? theme.colors.textSecondary
                      : theme.colors.text,
                  fontWeight: active ? 500 : 400,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: active ? '#ffffff' : theme.colors.textSecondary,
                    fontWeight: 400,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <FileTree
        model={model}
        style={
          {
            flex: 1,
            minHeight: 0,
            paddingTop: 8,
            '--trees-bg-override': 'transparent',
            '--trees-search-bg-override': theme.colors.backgroundSecondary,
            '--trees-theme-list-active-selection-bg': `color-mix(in oklab, ${theme.colors.accent} 28%, transparent)`,
            '--trees-theme-list-hover-bg': `color-mix(in oklab, ${theme.colors.accent} 14%, transparent)`,
            // Pin git-status colors to theme tokens. The library otherwise
            // derives them via CSS light-dark(), which needs an inherited
            // color-scheme that doesn't reach this panel — leaving changed
            // files visually unstyled. Overriding makes them deterministic.
            '--trees-git-modified-color-override': theme.colors.warning,
            '--trees-git-added-color-override': theme.colors.success,
            '--trees-git-untracked-color-override': theme.colors.success,
            '--trees-git-deleted-color-override': theme.colors.error,
            '--trees-git-renamed-color-override': theme.colors.info,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

function stripRoot(path: string, root: string): string {
  if (root && path.startsWith(root + '/')) return path.slice(root.length + 1);
  return path;
}

// Adapter: collapse the categorical buckets in `GitStatusWithFiles` (repo-
// relative paths) into Pierre's flat `GitStatusEntry[]`, keyed by the same
// tree-node `path` strings the FileTree renders. Git's relative paths are
// resolved to tree-node paths via each FileInfo's relativePath, so coloring
// works regardless of whether the tree uses absolute or relative paths. Pierre
// stores one status per path, so when a file appears in multiple buckets the
// later (higher-priority) write wins.
function buildGitStatusEntries(
  tree: RepoFileTree | null,
  status: GitStatusWithFiles | null | undefined,
): GitStatusEntry[] {
  if (!tree || !status) return [];
  // relativePath -> tree-node path, so git's relative buckets can be mapped
  // onto the exact strings the tree keys on.
  const relToPath = new Map<string, string>();
  for (const f of tree.allFiles) relToPath.set(f.relativePath, f.path);

  const map = new Map<string, GitStatusEntry['status']>();
  const set = (rel: string, s: GitStatusEntry['status']) => {
    const path = relToPath.get(rel);
    if (path) map.set(path, s);
  };
  for (const p of status.untrackedFiles) set(p, 'untracked');
  for (const p of status.createdFiles) set(p, 'added');
  for (const p of status.stagedFiles) set(p, 'modified');
  for (const p of status.modifiedFiles) set(p, 'modified');
  for (const p of status.deletedFiles) set(p, 'deleted');
  const entries: GitStatusEntry[] = [];
  for (const [path, s] of map) entries.push({ path, status: s });
  return entries;
}
