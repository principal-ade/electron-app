import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { makeSectionLabelStyle, withAlpha } from './styles';

export type RecentCommitFileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T';

export interface RecentCommitFile {
  path: string;
  status: RecentCommitFileStatus;
}

export interface RecentCommit {
  sha: string;
  subject: string;
  author: string;
  authoredAt: Date;
  filesChanged: number;
  additions: number;
  deletions: number;
  files: RecentCommitFile[];
}

interface RecentCommitCardProps {
  commit: RecentCommit;
  onClick?: () => void;
  /** When true, render a highlighted border so users can see the
   *  paired city-highlight layer is active. */
  active?: boolean;
  /** Fired when a row in the expanded file list is clicked. The file's
   *  status comes through so deletes can be skipped (no diff to show). */
  onFileClick?: (file: RecentCommitFile) => void;
  style?: React.CSSProperties;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const RecentCommitCard: React.FC<RecentCommitCardProps> = ({
  commit,
  onClick,
  active,
  onFileClick,
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

  const shaChipStyle: React.CSSProperties = {
    fontFamily: theme.fonts.monospace,
    fontSize: theme.fontSizes[0],
    color: theme.colors.textSecondary,
    background: withAlpha(
      theme.colors.backgroundDark ?? theme.colors.background,
      35,
    ),
    padding: '2px 6px',
    borderRadius: theme.radii[1],
  };

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
        }}
      >
        <div style={sectionLabelStyle}>Latest commit</div>
        <span style={shaChipStyle}>{commit.sha.slice(0, 7)}</span>
      </div>

      <div
        style={{
          fontSize: theme.fontSizes[1],
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {commit.subject}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: 8,
          }}
        >
          {commit.author}
        </span>
        <span>{formatRelativeTime(commit.authoredAt)}</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textTertiary,
          fontFamily: theme.fonts.monospace,
        }}
      >
        <span>
          {commit.filesChanged} file{commit.filesChanged === 1 ? '' : 's'}
        </span>
        <span style={{ color: theme.colors.success }}>+{commit.additions}</span>
        <span style={{ color: theme.colors.error }}>−{commit.deletions}</span>
      </div>

      {active && commit.files.length > 0 && (
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
          {commit.files.map((file) => {
            const statusColor =
              file.status === 'A' || file.status === 'C'
                ? theme.colors.success
                : file.status === 'D'
                  ? theme.colors.error
                  : theme.colors.warning;
            const clickable = onFileClick != null && file.status !== 'D';
            return (
              <div
                key={`${file.status}:${file.path}`}
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
                  fontSize: theme.fontSizes[0],
                  fontFamily: theme.fonts.monospace,
                  cursor: clickable ? 'pointer' : 'default',
                  padding: '2px 4px',
                  margin: '0 -4px',
                  borderRadius: theme.radii[1],
                }}
                onMouseEnter={
                  clickable
                    ? (e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          withAlpha(theme.colors.text, 8);
                      }
                    : undefined
                }
                onMouseLeave={
                  clickable
                    ? (e) => {
                        (e.currentTarget as HTMLDivElement).style.background =
                          'transparent';
                      }
                    : undefined
                }
              >
                <span
                  style={{
                    color: statusColor,
                    width: 12,
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  {file.status}
                </span>
                <span
                  style={{
                    color: theme.colors.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    direction: 'rtl',
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {file.path}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
