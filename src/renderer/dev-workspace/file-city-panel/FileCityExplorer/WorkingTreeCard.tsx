import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { makeSectionLabelStyle, withAlpha } from './styles';

export type WorkingTreeFileStatus = 'A' | 'M' | 'D';

export interface WorkingTreeFile {
  path: string;
  status: WorkingTreeFileStatus;
  /** True when at least one change to this path is staged. */
  staged: boolean;
}

export interface WorkingTreeChanges {
  branch: string;
  ahead: number;
  behind: number;
  filesChanged: number;
  files: WorkingTreeFile[];
}

interface WorkingTreeCardProps {
  changes: WorkingTreeChanges;
  onClick?: () => void;
  active?: boolean;
  onFileClick?: (file: WorkingTreeFile) => void;
  /** Fired with the row's repo-relative path and its status color on
   *  mouse enter, and `null` on leave. The parent uses the color to paint
   *  a darkened hover-highlight that ties the city to the row visually. */
  onFileHoverChange?: (
    payload: { path: string; color: string } | null,
  ) => void;
  style?: React.CSSProperties;
}

export const WorkingTreeCard: React.FC<WorkingTreeCardProps> = ({
  changes,
  onClick,
  active,
  onFileClick,
  onFileHoverChange,
  style,
}) => {
  const { theme } = useTheme();
  const sectionLabelStyle = makeSectionLabelStyle(theme);

  const cardStyle: React.CSSProperties = {
    width: 280,
    background: withAlpha(theme.colors.background, 40),
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${active ? theme.colors.info : theme.colors.border}`,
    boxShadow: active
      ? `0 0 0 1px ${theme.colors.info}, ${theme.shadows[3]}`
      : theme.shadows[3],
    borderRadius: theme.radii[4],
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  };

  const branchChipStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    background: withAlpha(
      theme.colors.backgroundDark ?? theme.colors.background,
      35,
    ),
    padding: '2px 6px',
    borderRadius: theme.radii[1],
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 140,
    whiteSpace: 'nowrap',
  };

  const stagedCount = changes.files.reduce(
    (n, f) => (f.staged ? n + 1 : n),
    0,
  );
  const unstagedCount = changes.filesChanged - stagedCount;

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={sectionLabelStyle}>Working tree</div>
        <span style={branchChipStyle} title={changes.branch}>
          {changes.branch}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textTertiary,
          fontFamily: theme.fonts.monospace,
          flexWrap: 'wrap',
        }}
      >
        <span>
          {changes.filesChanged} file{changes.filesChanged === 1 ? '' : 's'}
        </span>
        {stagedCount > 0 && (
          <span style={{ color: theme.colors.success }}>
            {stagedCount} staged
          </span>
        )}
        {unstagedCount > 0 && (
          <span style={{ color: theme.colors.warning }}>
            {unstagedCount} unstaged
          </span>
        )}
        {changes.ahead > 0 && <span>↑{changes.ahead}</span>}
        {changes.behind > 0 && <span>↓{changes.behind}</span>}
      </div>

      {active && changes.files.length > 0 && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 8,
            borderTop: `1px solid ${withAlpha(theme.colors.border, 60)}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 200,
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {changes.files.map((file) => {
            const statusColor =
              file.status === 'A'
                ? theme.colors.success
                : file.status === 'D'
                  ? theme.colors.error
                  : theme.colors.warning;
            // Only deletions can't open a diff (file is gone). Untracked
            // files (status 'A' but not yet in git) will still open the
            // overlay; the overlay's empty state handles them.
            const clickable = onFileClick != null && file.status !== 'D';
            const slash = file.path.lastIndexOf('/');
            const name = slash >= 0 ? file.path.slice(slash + 1) : file.path;
            const dir = slash >= 0 ? file.path.slice(0, slash) : '';
            return (
              <div
                key={`${file.staged ? 's' : 'u'}:${file.status}:${file.path}`}
                title={file.path}
                onClick={
                  clickable
                    ? (e) => {
                        e.stopPropagation();
                        onFileClick?.(file);
                      }
                    : undefined
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: clickable ? 'pointer' : 'default',
                  padding: '4px 6px',
                  margin: '0 -6px',
                  borderRadius: theme.radii[2],
                }}
                onMouseEnter={(e) => {
                  if (clickable) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      withAlpha(theme.colors.text, 8);
                  }
                  onFileHoverChange?.({
                    path: file.path,
                    color: statusColor,
                  });
                }}
                onMouseLeave={(e) => {
                  if (clickable) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      'transparent';
                  }
                  onFileHoverChange?.(null);
                }}
              >
                <span
                  style={{
                    color: statusColor,
                    width: 12,
                    flexShrink: 0,
                    textAlign: 'center',
                    fontFamily: theme.fonts.monospace,
                    fontSize: theme.fontSizes[0],
                    // Lowercase staged-marker variant so unstaged vs staged is
                    // glanceable without a second column.
                    opacity: file.staged ? 1 : 0.7,
                  }}
                >
                  {file.staged ? file.status : file.status.toLowerCase()}
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  {dir && (
                    <span
                      style={{
                        fontFamily: theme.fonts.monospace,
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textMuted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dir}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
