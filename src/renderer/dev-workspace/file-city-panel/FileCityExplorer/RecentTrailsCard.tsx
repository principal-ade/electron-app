import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { makeSectionLabelStyle, withAlpha } from './styles';

interface RecentTrailsCardProps {
  entries: TrailIndexEntry[];
  selectedTrailId: string | null;
  onSelectTrail: (id: string | null) => void;
  /**
   * Fired when the user clicks the row's "Open" affordance. The handler
   * activates the trail and emits the renderer-local activation event so
   * the framework's auto-open hook surfaces the file-city-trail panel.
   */
  onOpenTrail?: (id: string) => void;
  style?: React.CSSProperties;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
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

export const RecentTrailsCard: React.FC<RecentTrailsCardProps> = ({
  entries,
  selectedTrailId,
  onSelectTrail,
  onOpenTrail,
  style,
}) => {
  const { theme } = useTheme();
  const sectionLabelStyle = makeSectionLabelStyle(theme);

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
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
        <div style={sectionLabelStyle}>Trails</div>
        <span
          style={{
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textTertiary,
          }}
        >
          {entries.length}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 320,
          overflowY: 'auto',
          margin: '0 -6px',
        }}
      >
        {entries.map((entry) => {
          const isSelected = entry.id === selectedTrailId;
          return (
            <div
              key={entry.id}
              onClick={() =>
                onSelectTrail(isSelected ? null : entry.id)
              }
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: '6px 8px',
                borderRadius: theme.radii[2],
                cursor: 'pointer',
                background: isSelected
                  ? withAlpha(theme.colors.info, 18)
                  : 'transparent',
                border: `1px solid ${
                  isSelected ? theme.colors.info : 'transparent'
                }`,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    withAlpha(theme.colors.text, 8);
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    'transparent';
                }
              }}
            >
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
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                  title={entry.title}
                >
                  {entry.title}
                </span>
                <span
                  style={{
                    fontFamily: theme.fonts.monospace,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textTertiary,
                    flexShrink: 0,
                  }}
                >
                  {entry.markerCount}
                </span>
                {onOpenTrail && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTrail(entry.id);
                    }}
                    title="Open trail in panel"
                    aria-label={`Open ${entry.title}`}
                    style={{
                      padding: '2px 8px',
                      borderRadius: theme.radii[1],
                      border: `1px solid ${theme.colors.border}`,
                      background: 'transparent',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: theme.fontSizes[0],
                      fontFamily: theme.fonts.body,
                      lineHeight: 1.4,
                      flexShrink: 0,
                    }}
                  >
                    Open
                  </button>
                )}
              </div>
              {entry.summaryPreview && (
                <span
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.summaryPreview}
                </span>
              )}
              <span
                style={{
                  fontSize: theme.fontSizes[0],
                  color: theme.colors.textMuted,
                }}
              >
                {formatRelativeTime(entry.updatedAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
