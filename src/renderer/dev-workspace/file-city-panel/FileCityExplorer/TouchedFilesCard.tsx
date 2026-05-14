import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { makeSectionLabelStyle, withAlpha } from './styles';

interface TouchedFilesCardProps {
  /** Repo-relative paths of every file touched by at least one trail. */
  touchedPaths: ReadonlySet<string>;
  /** Total number of buildings in the city — denominator for the explored %. */
  totalCount: number;
  hideUntouched: boolean;
  onToggleHideUntouched: () => void;
  /**
   * Fires when the user picks a row in the tree (or clears the selection).
   * `isDirectory` lets the parent decide whether to treat the path as an
   * exact file match or a prefix for descendants.
   */
  onSelect?: (path: string | null, isDirectory: boolean) => void;
  style?: React.CSSProperties;
}

export const TouchedFilesCard: React.FC<TouchedFilesCardProps> = ({
  touchedPaths,
  totalCount,
  hideUntouched,
  onToggleHideUntouched,
  onSelect,
  style,
}) => {
  const { theme } = useTheme();
  const sectionLabelStyle = makeSectionLabelStyle(theme);

  const exploredCount = touchedPaths.size;
  const percent =
    totalCount > 0 ? Math.round((exploredCount / totalCount) * 100) : 0;

  // Stabilize the path list by content. The Set identity changes on every
  // parent render (it's rebuilt by a useMemo whose deps include other
  // arrays), so we hash to a sorted, joined string and only produce a new
  // array when the underlying contents actually change. Without this, the
  // resetPaths effect below fires every render and collapses the tree.
  const pathsKey = React.useMemo(
    () => Array.from(touchedPaths).sort().join('\n'),
    [touchedPaths],
  );
  const sortedPaths = React.useMemo(
    () => (pathsKey ? pathsKey.split('\n') : []),
    [pathsKey],
  );

  const modelRef = React.useRef<ReturnType<typeof useFileTree>['model'] | null>(
    null,
  );
  const { model } = useFileTree({
    paths: sortedPaths,
    search: false,
    onSelectionChange: (selected) => {
      const next = selected[0] ?? null;
      if (!onSelect) return;
      if (!next) {
        onSelect(null, false);
        return;
      }
      const item = modelRef.current?.getItem(next);
      onSelect(next, item?.isDirectory() ?? false);
    },
  });
  modelRef.current = model;

  const isFirstSync = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSync.current) {
      isFirstSync.current = false;
      return;
    }
    model.resetPaths(sortedPaths);
  }, [model, sortedPaths]);

  const cardStyle: React.CSSProperties = {
    width: 280,
    background: withAlpha(theme.colors.background, 40),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows[3],
    borderRadius: theme.radii[4],
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 0,
    ...style,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={sectionLabelStyle}>Explored</div>
        <span
          style={{
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textTertiary,
          }}
        >
          {exploredCount}/{totalCount}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[3],
            color: theme.colors.info,
            lineHeight: 1,
          }}
        >
          {percent}%
        </span>
        <button
          type="button"
          onClick={onToggleHideUntouched}
          title={
            hideUntouched
              ? 'Show all files in the city'
              : 'Hide files no trail has touched'
          }
          disabled={exploredCount === 0}
          style={{
            padding: '4px 10px',
            borderRadius: theme.radii[1],
            border: `1px solid ${
              hideUntouched ? theme.colors.info : theme.colors.border
            }`,
            background: hideUntouched
              ? withAlpha(theme.colors.info, 18)
              : 'transparent',
            color: hideUntouched ? theme.colors.info : theme.colors.text,
            cursor: exploredCount === 0 ? 'not-allowed' : 'pointer',
            opacity: exploredCount === 0 ? 0.5 : 1,
            fontSize: theme.fontSizes[0],
            fontFamily: theme.fonts.body,
            lineHeight: 1.4,
            flexShrink: 0,
          }}
        >
          {hideUntouched ? 'Show all' : 'Hide untouched'}
        </button>
      </div>

      <div
        style={{
          height: 360,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          margin: '0 -18px -16px',
        }}
      >
        {exploredCount === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes[0],
              textAlign: 'center',
            }}
          >
            No trail has touched a file yet.
          </div>
        ) : (
          <FileTree
            model={model}
            style={
              {
                flex: 1,
                minHeight: 0,
                display: 'block',
                '--trees-bg-override': 'transparent',
                '--trees-padding-inline-override': '4px',
                '--trees-item-margin-x-override': '0px',
                '--trees-theme-list-active-selection-bg': `color-mix(in oklab, ${theme.colors.info} 28%, transparent)`,
                '--trees-theme-list-hover-bg': `color-mix(in oklab, ${theme.colors.info} 14%, transparent)`,
              } as React.CSSProperties
            }
          />
        )}
      </div>
    </div>
  );
};
