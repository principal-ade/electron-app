import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { useFileTree } from '@pierre/trees/react';
import type { GitStatusEntry } from '@pierre/trees';
import { ThemedFileTree } from '../../components/shared/ThemedFileTree';
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

interface FilesPanelContext extends PanelContextValue {
  fileTree?: DataSlice<RepoFileTree | null>;
  gitStatusWithFiles?: DataSlice<GitStatusWithFiles | null>;
}

export interface FilesPanelProps {
  context: FilesPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
}

type FileFilter = 'all' | 'touched';

/**
 * The dev workspace file tree.
 *
 * This used to carry a Scopes tab, a coverage/audit filter, an "add to scope"
 * modal, and a drag host — scope-authoring tooling layered on top of the tree.
 * That tooling has been deprecated here in favor of the slimmer Alexandria
 * workspace panel: a plain repository file tree with git-status coloring and a
 * single toggle to narrow the view to files that have been "touched" (have
 * uncommitted git changes).
 *
 * The scope system itself is NOT gone — `ScopeManagerProvider` is still mounted
 * by DevWorkspaceApp and consumed by the File City explorer. This panel simply
 * no longer reads or writes scopes. Areas authored in the trail view are the
 * intended future on-ramp to formalized scopes; until that lands, the file tree
 * stays scope-agnostic.
 */
export const FilesPanel: React.FC<FilesPanelProps> = ({ context, events }) => {
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

  // Ancestor directories (tree-node ids) of every file in the current view.
  // Used to auto-open folders in the "Touched" filter so its small, narrowed
  // set is visible rather than buried under collapsed parents. Derived from
  // prefixes of each file's own tree-node path — those are exactly the
  // directory ids @pierre/trees created from the same strings, so getItem()
  // resolves them regardless of whether paths are absolute or repo-relative.
  const ancestorDirPaths = React.useMemo<string[]>(() => {
    const dirs = new Set<string>();
    for (const p of filteredPaths) {
      const segments = p.split('/');
      // Every prefix up to (but not including) the file itself is an ancestor
      // directory: a/b/c.ts -> "a", "a/b".
      for (let i = 1; i < segments.length; i++) {
        const dir = segments.slice(0, i).join('/');
        if (dir) dirs.add(dir);
      }
    }
    return Array.from(dirs);
  }, [filteredPaths]);

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
        source: 'files-panel',
        timestamp: Date.now(),
        payload: { path: stripRoot(next, rootPath) },
      });
    },
  });
  modelRef.current = model;

  // Re-clicking a file that is already selected must still (re)open it — but the
  // tree only fires onSelectionChange when the selection *changes*, so clicking
  // the already-selected row is silent. This bites after a tab is closed: the
  // tree is never told the tab went away, so the file's row stays selected and
  // its row becomes un-clickable. We keep the selection highlight (it marks the
  // last-opened file) and patch only the gap: remember what was selected when
  // the pointer went down, and if the click lands on that same file row, emit
  // file:open ourselves. New-file clicks and keyboard nav still flow through
  // onSelectionChange (selection genuinely changes), so this never double-fires.
  const selectedAtPointerDown = React.useRef<string | null>(null);

  const handlePointerDownCapture = React.useCallback(() => {
    selectedAtPointerDown.current =
      modelRef.current?.getSelectedPaths()[0] ?? null;
  }, []);

  const handleClickCapture = React.useCallback(
    (e: React.MouseEvent) => {
      // Rows live in the FileTree web component's shadow DOM; click events are
      // composed, so composedPath() exposes the row element and its
      // `data-item-path` / `data-item-type` attributes (set by @pierre/trees).
      const row = e.nativeEvent
        .composedPath()
        .find(
          (el): el is HTMLElement =>
            el instanceof HTMLElement &&
            el.getAttribute('data-item-path') != null,
        );
      if (!row || row.getAttribute('data-item-type') !== 'file') return;
      const path = row.getAttribute('data-item-path');
      // Only the re-click-on-the-selected-row case; everything else is a real
      // selection change that onSelectionChange already handles.
      if (!path || path !== selectedAtPointerDown.current) return;
      events.emit({
        type: 'file:open',
        source: 'files-panel',
        timestamp: Date.now(),
        payload: { path: stripRoot(path, rootPath) },
      });
    },
    [events, rootPath],
  );

  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(filteredPaths, { initialExpandedPaths });
  }, [model, filteredPaths, initialExpandedPaths]);

  // Auto-expand folders so the "Touched" filter reveals its files instead of
  // leaving them collapsed. Runs after the resetPaths effect above (declaration
  // order = run order on the same commit), so it operates on the rebuilt tree.
  // "All files" is left collapsed-to-root — auto-opening the whole repo would
  // be overwhelming. Expansion is driven imperatively via getItem().expand()
  // rather than resetPaths' initialExpandedPaths, whose sorted-prefix walk is
  // unreliable across rebuilds.
  React.useEffect(() => {
    if (effectiveFilter !== 'touched') return;
    for (const dir of ancestorDirPaths) {
      // getItem accepts a bare directory path; fall back to the trailing-slash
      // canonical form defensively. `'expand' in item` narrows the handle union
      // to a directory handle — isDirectory() returns a plain boolean and
      // doesn't narrow the type.
      const item = model.getItem(dir) ?? model.getItem(`${dir}/`);
      if (item && 'expand' in item && !item.isExpanded()) item.expand();
    }
  }, [model, effectiveFilter, ancestorDirPaths]);

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
                    ? theme.colors.textOnPrimary
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
                    color: active ? theme.colors.textOnPrimary : theme.colors.textSecondary,
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
        onPointerDownCapture={handlePointerDownCapture}
        onClickCapture={handleClickCapture}
      >
        <ThemedFileTree model={model} gitStatusColors style={{ paddingTop: 8 }} />
      </div>
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
