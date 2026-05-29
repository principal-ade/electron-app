import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileTree, useFileTree } from '@pierre/trees/react';

/**
 * One touched file in the Files view: a repo-relative path plus how many of
 * the filtered trails reference it (via at least one marker `sourcePath`).
 * `trailCount` drives the per-row "×N" decoration so the tree mirrors the
 * city's aggregate heat-map — files touched by more trails read hotter.
 */
export interface TrailFileRow {
  /** Repo-relative path, e.g. `src/renderer/foo.ts`. */
  path: string;
  /** Distinct trails (in the active project) that touch this file. */
  trailCount: number;
}

export interface TrailsRecentFilesProps {
  /** Touched files across the filtered trails. Order doesn't matter. */
  files: TrailFileRow[];
  /** Repo-relative path currently spotlighted on the city, or null. */
  selectedPath: string | null;
  /**
   * Fired when the user picks a file row. Receives the repo-relative path, or
   * null when the selection is cleared. Parent toggles the city spotlight.
   */
  onSelectFile: (path: string | null) => void;
  /** Filtered trails whose payload hasn't loaded yet — drives the footer. */
  pendingCount: number;
  /** Copy shown when no trail touches any file yet. */
  emptyLabel?: string;
}

/**
 * The Files pivot of the Recent feed. Reuses the canonical `@pierre/trees`
 * FileTree (same component the dev-workspace Files panel renders) instead of
 * hand-rolling a tree, so it gets expand/collapse, search, virtualization and
 * single-child-chain flattening for free. The tree is built from the union of
 * `marker.sourcePath`s across the filtered trails and rooted at the repo root
 * (paths are repo-relative, no root prefix). Selecting a file reports the path
 * up so the parent can spotlight that building on the city.
 */
export const TrailsRecentFiles: React.FC<TrailsRecentFilesProps> = ({
  files,
  selectedPath,
  onSelectFile,
  pendingCount,
  emptyLabel = 'No files touched by these trails yet.',
}) => {
  const { theme } = useTheme();

  // Sorted, de-duplicated path list. @pierre/trees' Builder rejects
  // consecutive duplicate paths, and a file can be touched by several trails,
  // so dedupe before handing paths to the model.
  const paths = React.useMemo<string[]>(
    () => Array.from(new Set(files.map((f) => f.path))).sort(),
    [files],
  );

  // path -> trail count, for the per-row "×N" decoration.
  const countByPath = React.useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const f of files) map.set(f.path, f.trailCount);
    return map;
  }, [files]);

  const modelRef = React.useRef<ReturnType<typeof useFileTree>['model'] | null>(
    null,
  );
  const { model } = useFileTree({
    paths,
    search: true,
    // Flatten single-child dir chains (e.g. src/renderer/principal-window/…)
    // so collapsed top-level rows stay shallow. Start collapsed — the user
    // drills into the folders they care about rather than facing every
    // touched file expanded at once.
    flattenEmptyDirectories: true,
    initialExpansion: 'closed',
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    onSelectionChange: (selected) => {
      const next = selected[0] ?? null;
      // Directory rows shouldn't drive the single-file spotlight; only emit
      // for file selections (and for clears).
      if (next) {
        const item = modelRef.current?.getItem(next);
        if (item && item.isDirectory()) return;
      }
      onSelectFile(next);
    },
    renderRowDecoration: ({ row }) => {
      if (row.kind !== 'file') return null;
      const count = countByPath.get(row.path);
      if (!count) return null;
      return {
        text: `×${count}`,
        title: `Touched by ${count} ${count === 1 ? 'trail' : 'trails'}`,
      };
    },
  });
  modelRef.current = model;

  // Keep the model's path set in sync as payloads resolve / filters change.
  // Skip the first run — the model already mounted with `paths`.
  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(paths, {});
  }, [model, paths]);

  if (paths.length === 0) {
    return (
      <div
        style={{
          padding: '32px 8px',
          textAlign: 'center',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          opacity: 0.5,
        }}
      >
        {pendingCount > 0
          ? `Loading ${pendingCount} ${pendingCount === 1 ? 'trail' : 'trails'}…`
          : emptyLabel}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}
    >
      <FileTree
        model={model}
        style={
          {
            flex: 1,
            minHeight: 0,
            '--trees-bg-override': 'transparent',
            '--trees-search-bg-override': theme.colors.backgroundSecondary,
            '--trees-theme-list-active-selection-bg': `color-mix(in oklab, ${theme.colors.accent} 28%, transparent)`,
            '--trees-theme-list-hover-bg': `color-mix(in oklab, ${theme.colors.accent} 14%, transparent)`,
          } as React.CSSProperties
        }
      />
      {pendingCount > 0 && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '8px 4px',
            textAlign: 'center',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            opacity: 0.6,
          }}
        >
          Loading {pendingCount} more {pendingCount === 1 ? 'trail' : 'trails'}…
        </div>
      )}
    </div>
  );
};
