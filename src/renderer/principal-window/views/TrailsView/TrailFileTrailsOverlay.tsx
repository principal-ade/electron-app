import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X } from 'lucide-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

export interface TrailFileTrailsOverlayProps {
  /** Repo-relative path of the file the user picked in the tree. */
  filePath: string;
  /** Trails that touch `filePath` (via at least one marker `sourcePath`). */
  trails: TrailIndexEntry[];
  /** Trail currently open in the pane behind the overlay, if any. */
  selectedTrailId: string | null;
  /** Human label for a trail's repo (owner/name or folder). */
  resolveRepoLabel: (trail: TrailIndexEntry) => string;
  /** Fired when a trail row is clicked — parent opens it in the pane. */
  onSelectTrail: (trail: TrailIndexEntry) => void;
  /** Dismiss the overlay (backdrop click or the × button). */
  onClose: () => void;
}

/**
 * Floating panel over the trail explorer listing every trail that touches the
 * file selected in the Files tree. Clicking a row opens that trail in the pane
 * behind it. Anchored top so the city stays partly visible under the
 * translucent backdrop; clicking the backdrop dismisses.
 */
export const TrailFileTrailsOverlay: React.FC<TrailFileTrailsOverlayProps> = ({
  filePath,
  trails,
  selectedTrailId,
  resolveRepoLabel,
  onSelectTrail,
  onClose,
}) => {
  const { theme } = useTheme();
  const accent = theme.colors.primary ?? '#3b82f6';
  const basename = filePath.split('/').pop() || filePath;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          maxHeight: '100%',
          borderRadius: 10,
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header — file identity + close. */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '12px 12px 10px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={filePath}
              style={{
                fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {basename}
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
              }}
            >
              {trails.length} {trails.length === 1 ? 'trail' : 'trails'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              all: 'unset',
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              cursor: 'pointer',
              color: theme.colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Trail list. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {trails.map((trail) => {
            const isSelected = selectedTrailId === trail.id;
            const selectedBg = `color-mix(in srgb, ${accent} 22%, ${theme.colors.background})`;
            const purpose = trail.purpose ?? 'investigation';
            return (
              <button
                key={trail.id}
                type="button"
                onClick={() => onSelectTrail(trail)}
                title={trail.title || 'Untitled trail'}
                style={{
                  all: 'unset',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${accent}`,
                  backgroundColor: isSelected ? selectedBg : 'transparent',
                  cursor: 'pointer',
                  transition:
                    'background-color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (isSelected) return;
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary ?? theme.colors.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? selectedBg
                    : 'transparent';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: accent,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isSelected ? '#ffffff' : accent,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.semibold,
                    }}
                  >
                    {trail.title || 'Untitled trail'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 16,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {resolveRepoLabel(trail)}
                  </span>
                  <span aria-hidden>·</span>
                  <span style={{ textTransform: 'capitalize' }}>{purpose}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
