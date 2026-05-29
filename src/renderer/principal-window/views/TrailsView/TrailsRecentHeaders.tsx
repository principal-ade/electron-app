import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

/**
 * One aggregated row in the headers view: a single top-level sequence-diagram
 * lane (e.g. `auth`, `db`, `renderer`) and the filtered trails that contain
 * at least one marker mapping to that lane. Rows are ordered by `trails.length`
 * descending in the parent so frequently-shared headers float to the top.
 */
export interface TrailHeaderRow {
  /** Top-level namespace string — first dotted segment of marker name / participant / actor. */
  header: string;
  /** Filtered trails (date-sorted upstream) that contribute this header. */
  trails: TrailIndexEntry[];
  /**
   * Longest directory prefix shared by every file referenced under this
   * area (across all contributing trails). `''` when files span multiple
   * top-level folders (no meaningful common parent) or the area has no
   * files yet. Shown on the card as a small subtitle so the user can see
   * at a glance which part of the repo an area lives in, and used by the
   * parent to draw a folder-border highlight in the city on hover.
   */
  commonParent: string;
  /** Distinct *live* file count under this area (drives the card subtitle). */
  fileCount: number;
  /** Distinct stale paths in this area (badge count). 0 when file tree hasn't loaded. */
  staleFileCount: number;
  /**
   * Trail-centric stale view used when the user opens the "N missing"
   * badge. Each entry is one offending trail and the (path, step) pairs in
   * that trail that no longer resolve against the working tree. Ordered by
   * missing-count desc so the trails needing the most repointing surface
   * first. Empty when the file tree hasn't loaded yet or nothing is stale.
   */
  staleByTrail: Array<{
    trail: TrailIndexEntry;
    missing: Array<{ path: string; steps: string[] }>;
  }>;
}

export interface TrailsRecentHeadersProps {
  rows: TrailHeaderRow[];
  /** Trail id currently selected for preview, or null. */
  selectedTrailId: string | null;
  /**
   * Fired on chip click. Receives the full trail; parent decides whether to
   * select, toggle off, or open.
   */
  onSelectTrail: (trail: TrailIndexEntry) => void;
  /**
   * Area header currently selected, or null. The matching row paints with
   * a tinted background so the user can see which area is driving the
   * city's highlight layer in the right pane.
   */
  selectedHeader: string | null;
  /**
   * Fired when the user clicks the row header (not a trail chip). Receives
   * the header string; parent decides whether to toggle off if the same row
   * is clicked twice.
   */
  onSelectHeader: (header: string) => void;
  /**
   * Fired when the pointer enters or leaves an area card. Receives the
   * header on enter, `null` on leave. Parent uses this to paint a folder-
   * border highlight in the city for the hovered area's common parent.
   */
  onHoverHeader: (header: string | null) => void;
  /**
   * Fired when the pointer enters or leaves a trail row inside an expanded
   * area card. Receives the trail id on enter, `null` on leave. Parent
   * paints a fill highlight in the city for that trail's marker
   * `sourcePath`s so the user can see the trail's footprint without
   * clicking.
   */
  onHoverTrail: (trailId: string | null) => void;
  /**
   * Number of filtered trails whose payload hasn't loaded yet. When > 0 we
   * show a small "loading N more" footer so users know rows may still shift.
   */
  pendingCount: number;
  /** Copy shown when there are no filtered trails at all. */
  emptyLabel?: string;
}

/**
 * Trail chips no longer color by purpose — they use the primary accent to
 * match `TrailCard` in the list view.
 */
const purposeChipColor = (
  _trail: TrailIndexEntry,
  theme: ReturnType<typeof useTheme>['theme'],
): string => theme.colors.primary ?? '#3b82f6';

export const TrailsRecentHeaders: React.FC<TrailsRecentHeadersProps> = ({
  rows,
  selectedTrailId,
  onSelectTrail,
  selectedHeader,
  onSelectHeader,
  onHoverHeader,
  onHoverTrail,
  pendingCount,
  emptyLabel = 'No matching trails.',
}) => {
  const { theme } = useTheme();

  // Which area card has its stale-files list open. Only one open at a time —
  // and only meaningful while that card is the currently selected (expanded)
  // area, since stale-mode is rendered inside the card body.
  const [expandedStaleHeader, setExpandedStaleHeader] = useState<string | null>(
    null,
  );

  // When the user collapses the expanded card (deselects the area or
  // selects a different one), drop any lingering stale-mode state for the
  // old card so it doesn't snap back on the next expand.
  useEffect(() => {
    if (expandedStaleHeader && expandedStaleHeader !== selectedHeader) {
      setExpandedStaleHeader(null);
    }
  }, [selectedHeader, expandedStaleHeader]);

  if (rows.length === 0) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => {
        const isAreaSelected = selectedHeader === row.header;
        const areaAccent = theme.colors.primary ?? '#3b82f6';
        return (
        <div
          key={row.header}
          onMouseEnter={() => onHoverHeader(row.header)}
          onMouseLeave={() => onHoverHeader(null)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 8,
            // Selection state is shown via a thicker accent border + accent-
            // colored header label; the body stays on the neutral background
            // so the purpose-colored trail chips inside stay readable.
            border: isAreaSelected
              ? `2px solid ${areaAccent}`
              : `1px solid ${theme.colors.border}`,
            // Compensate the 1→2px border bump so rows don't jump when
            // selection changes.
            margin: isAreaSelected ? '-1px' : 0,
            backgroundColor: theme.colors.background,
            transition: 'border-color 120ms ease',
          }}
        >
          <button
            type="button"
            onClick={() => onSelectHeader(row.header)}
            title={
              isAreaSelected
                ? `Clear area filter (${row.header})`
                : `Show only files in "${row.header}" on the city`
            }
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              fontFamily: theme.fonts.body,
            }}
          >
            <span
              style={{
                fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                color: isAreaSelected ? areaAccent : theme.colors.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}
            >
              {row.header}
            </span>
            <span
              aria-label={`${row.trails.length} ${row.trails.length === 1 ? 'trail' : 'trails'}`}
              style={{
                flex: '0 0 auto',
                padding: '2px 8px',
                borderRadius: 999,
                border: `1px solid ${isAreaSelected ? areaAccent : theme.colors.border}`,
                fontSize: theme.fontSizes[0],
                color: isAreaSelected ? areaAccent : theme.colors.textSecondary,
              }}
            >
              ×{row.trails.length}
            </span>
          </button>
          {(row.commonParent ||
            row.fileCount > 0 ||
            row.staleFileCount > 0) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                minWidth: 0,
              }}
            >
              <span
                title={
                  row.commonParent
                    ? `Files in this area share parent "${row.commonParent}"`
                    : 'Files in this area span multiple top-level folders'
                }
                style={{
                  fontFamily: theme.fonts.monospace ?? theme.fonts.body,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {row.commonParent
                  ? row.commonParent + '/'
                  : row.fileCount > 0
                    ? '(spans repo)'
                    : ''}
              </span>
              {row.fileCount > 0 && (
                <span style={{ flex: '0 0 auto' }}>
                  {row.fileCount} {row.fileCount === 1 ? 'file' : 'files'}
                </span>
              )}
              {row.staleFileCount > 0 && (() => {
                const open =
                  expandedStaleHeader === row.header && isAreaSelected;
                const warnColor = theme.colors.warning ?? '#f59e0b';
                const ChevronIcon = open ? ChevronDown : ChevronRight;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (open) {
                        // Just turn off stale-mode; keep the card expanded.
                        setExpandedStaleHeader(null);
                        return;
                      }
                      // Ensure the card is expanded (= area selected) before
                      // entering stale-mode, so the offending-trails list
                      // actually has somewhere to render.
                      if (!isAreaSelected) onSelectHeader(row.header);
                      setExpandedStaleHeader(row.header);
                    }}
                    aria-expanded={open}
                    title={
                      open
                        ? 'Show all trails'
                        : `${row.staleFileCount} file${row.staleFileCount === 1 ? '' : 's'} this area references no longer exist`
                    }
                    style={{
                      flex: '0 0 auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: `1px solid ${warnColor}`,
                      backgroundColor: open
                        ? `color-mix(in srgb, ${warnColor} 18%, ${theme.colors.background})`
                        : 'transparent',
                      color: warnColor,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      fontWeight: theme.fontWeights.semibold,
                      cursor: 'pointer',
                    }}
                  >
                    <AlertTriangle size={11} />
                    {row.staleFileCount} missing
                    <ChevronIcon size={11} />
                  </button>
                );
              })()}
            </div>
          )}
          {/* Trails only render when the card is expanded — i.e. the area
              is the currently selected one. Two render modes inside:
              - Default: pill chips, one per contributing trail (compact).
              - Stale-mode (badge open): each offending trail is rendered as
                an expanded item showing the (path, step) pairs it has gone
                stale on, so the user can pinpoint the work without a
                separate panel. Trails with no stale entries don't appear in
                this mode.  */}
          {isAreaSelected && (expandedStaleHeader === row.header ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {row.staleByTrail.map((entry) => {
                const color = purposeChipColor(entry.trail, theme);
                const isSelected = selectedTrailId === entry.trail.id;
                const selectedBg = `color-mix(in srgb, ${color} 22%, ${theme.colors.background})`;
                return (
                  <button
                    key={entry.trail.id}
                    type="button"
                    onClick={() => onSelectTrail(entry.trail)}
                    onMouseEnter={() => onHoverTrail(entry.trail.id)}
                    onMouseLeave={() => onHoverTrail(null)}
                    title={entry.trail.title || 'Untitled trail'}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${color}`,
                      backgroundColor: isSelected
                        ? selectedBg
                        : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: isSelected ? '#ffffff' : color,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.semibold,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {entry.trail.title || 'Untitled trail'}
                      </span>
                      <span
                        style={{
                          flex: '0 0 auto',
                          fontWeight: theme.fontWeights.body,
                          color: theme.colors.warning ?? '#f59e0b',
                        }}
                      >
                        {entry.missing.length} missing
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {entry.missing.map((m) => (
                        <li
                          key={m.path}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            fontFamily: theme.fonts.body,
                            fontSize: theme.fontSizes[0],
                          }}
                        >
                          <span
                            title={m.path}
                            style={{
                              fontFamily:
                                theme.fonts.monospace ?? theme.fonts.body,
                              color: theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.path}
                          </span>
                          {m.steps.length > 0 && (
                            <span
                              style={{
                                color: theme.colors.textSecondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              step{m.steps.length === 1 ? '' : 's'}:{' '}
                              {m.steps.join(', ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {row.trails.map((trail) => {
                const color = purposeChipColor(trail, theme);
                const isSelected = selectedTrailId === trail.id;
                const selectedBg = `color-mix(in srgb, ${color} 22%, ${theme.colors.background})`;
                return (
                  <button
                    key={trail.id}
                    type="button"
                    onClick={() => onSelectTrail(trail)}
                    title={trail.title || 'Untitled trail'}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${color}`,
                      backgroundColor: isSelected
                        ? selectedBg
                        : 'transparent',
                      cursor: 'pointer',
                      transition:
                        'background-color 120ms ease, border-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      onHoverTrail(trail.id);
                      if (isSelected) return;
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary ?? theme.colors.border;
                    }}
                    onMouseLeave={(e) => {
                      onHoverTrail(null);
                      e.currentTarget.style.backgroundColor = isSelected
                        ? selectedBg
                        : 'transparent';
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        marginTop: 5,
                        borderRadius: '50%',
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                        color: isSelected ? '#ffffff' : color,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[0],
                        fontWeight: theme.fontWeights.semibold,
                      }}
                    >
                      {trail.title || 'Untitled trail'}
                    </span>
                    {trail.fileCount !== undefined && trail.fileCount > 0 && (
                      <span
                        style={{
                          flex: '0 0 auto',
                          marginTop: 1,
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[0],
                        }}
                      >
                        {trail.fileCount}{' '}
                        {trail.fileCount === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        );
      })}
      {pendingCount > 0 && (
        <div
          style={{
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
