/**
 * TrailProjectCityCard
 *
 * Per-project card for the Trails recent feed when grouped by project.
 * Modeled on the live-activity `CityCard`: header (owner avatar + repo
 * label + trail count) over a full-width File City, with a footer
 * button that reveals the project's trails when clicked.
 *
 * The card owns its own File City loading and expand state. Trail
 * selection bubbles up via `onSelectTrail` so the parent's right-side
 * preview pane still drives the rest of the recent view.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Footprints, FolderGit2, Loader2 } from 'lucide-react';
import {
  ArchitectureMapHighlightLayers,
  MultiVersionCityBuilder,
  type CityData,
  type HighlightLayer,
} from '@principal-ai/file-city-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';

/** Relative-time formatter mirroring the one in TrailsView. */
function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export interface TrailProjectCityCardProps {
  repoLabel: string;
  /** Local filesystem path. When absent the city panel renders an empty state. */
  repositoryPath?: string;
  ownerAvatarUrl: string | null;
  trails: TrailIndexEntry[];
  selectedTrailId: string | null;
  onSelectTrail: (trail: TrailIndexEntry) => void;
}

export const TrailProjectCityCard: React.FC<TrailProjectCityCardProps> = ({
  repoLabel,
  repositoryPath,
  ownerAvatarUrl,
  trails,
  selectedTrailId,
  onSelectTrail,
}) => {
  const { theme } = useTheme();
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  // Repo-relative file paths touched by any trail in this group. Loaded
  // lazily from each trail's full payload because the index entry only
  // carries metadata, not markers.
  const [touchedPaths, setTouchedPaths] = useState<string[]>([]);

  // Square-based-on-width: measure the card's own width and set the city
  // panel's height to match. `aspect-ratio` / padding-bottom tricks are
  // unreliable inside flex columns, so we drive it imperatively. We
  // observe the card root (not the city div) so the measurement is
  // independent of the height we're computing — and we subtract the
  // border so the inner square fits flush.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [citySize, setCitySize] = useState(0);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const sync = () => {
      const w = node.clientWidth; // border-box minus borders
      setCitySize(w);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!repositoryPath) {
      setCityData(null);
      setCityLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setCityLoading(true);
    setCityData(null);
    void (async () => {
      try {
        const fileTree =
          await RepositoryMonitoringService.getFileTree(repositoryPath);
        if (cancelled) return;
        if (fileTree) {
          const versionMap = new Map([['main', fileTree]]);
          const { unionCity } = MultiVersionCityBuilder.build(versionMap);
          if (!cancelled) setCityData(unionCity);
        }
      } catch (err) {
        console.warn(
          `[TrailProjectCityCard] Failed to build city for ${repoLabel}:`,
          err,
        );
      } finally {
        if (!cancelled) setCityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repositoryPath, repoLabel]);

  // Resolve each trail's markers → sourcePath so we can highlight every
  // file the group's trails touch on the city map.
  useEffect(() => {
    let cancelled = false;
    const trailIds = trails.map((t) => t.id);
    if (trailIds.length === 0) {
      setTouchedPaths([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const paths = new Set<string>();
      const payloads = await Promise.all(
        trailIds.map((id) => TrailLibraryService.load(id)),
      );
      if (cancelled) return;
      for (const payload of payloads) {
        if (!payload) continue;
        for (const marker of payload.markers ?? []) {
          if (marker.sourcePath) paths.add(marker.sourcePath);
        }
      }
      if (!cancelled) setTouchedPaths(Array.from(paths));
    })();
    return () => {
      cancelled = true;
    };
  }, [trails]);

  const highlightLayers = useMemo<HighlightLayer[]>(() => {
    if (touchedPaths.length === 0) return [];
    return [
      {
        id: 'trail-touched-files',
        name: 'Trail-touched files',
        enabled: true,
        color: theme.colors.primary,
        opacity: 0.85,
        priority: 1,
        items: touchedPaths.map((path) => ({
          path,
          type: 'file' as const,
        })),
      },
    ];
  }, [touchedPaths, theme.colors.primary]);

  return (
    <div
      ref={cardRef}
      style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: 10,
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 10,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        {ownerAvatarUrl ? (
          <img
            src={ownerAvatarUrl}
            alt=""
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${theme.colors.border}`,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
              flexShrink: 0,
            }}
          >
            <FolderGit2 size={14} />
          </div>
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repoLabel}
          </div>
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Footprints size={11} />
            {trails.length} {trails.length === 1 ? 'trail' : 'trails'}
          </div>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: citySize,
          flexShrink: 0,
          backgroundColor: theme.colors.background,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          {cityLoading ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: theme.colors.textSecondary,
              }}
            >
              <Loader2
                size={20}
                style={{ animation: 'trails-spin 1s linear infinite' }}
              />
              <span
                style={{
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                }}
              >
                Loading…
              </span>
            </div>
          ) : cityData ? (
            <ArchitectureMapHighlightLayers
              cityData={cityData}
              highlightLayers={highlightLayers}
              fullSize
              showFileNames={false}
              canvasBackgroundColor={theme.colors.background}
              maxCanvasSize={1024}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderGit2
                size={48}
                color={theme.colors.textSecondary}
                style={{ opacity: 0.4 }}
              />
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          padding: '10px 12px',
          borderTop: `1px solid ${theme.colors.border}`,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {expanded
            ? 'Hide trails'
            : `Show ${trails.length} ${
                trails.length === 1 ? 'trail' : 'trails'
              }`}
        </span>
        <span
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {trails.map((trail) => {
            const isSelected = selectedTrailId === trail.id;
            return (
              <button
                key={trail.id}
                type="button"
                onClick={() => onSelectTrail(trail)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  background: isSelected
                    ? `color-mix(in srgb, ${theme.colors.accent} 12%, ${theme.colors.background})`
                    : 'transparent',
                  color: theme.colors.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: theme.fonts.body,
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (isSelected) return;
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary ?? theme.colors.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? `color-mix(in srgb, ${theme.colors.accent} 12%, ${theme.colors.background})`
                    : 'transparent';
                }}
              >
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontWeight: theme.fontWeights.semibold,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {trail.title || 'Untitled trail'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textSecondary,
                  }}
                >
                  {trail.markerCount > 0 && (
                    <span
                      aria-label={`${trail.markerCount} steps`}
                      style={{ display: 'inline-flex', gap: 3 }}
                    >
                      {Array.from({
                        length: Math.min(trail.markerCount, 24),
                      }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            backgroundColor: theme.colors.textSecondary,
                            opacity: 0.6,
                          }}
                        />
                      ))}
                      {trail.markerCount > 24 ? (
                        <span style={{ marginLeft: 4 }}>
                          +{trail.markerCount - 24}
                        </span>
                      ) : null}
                    </span>
                  )}
                  <span>{formatRelativeTime(trail.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrailProjectCityCard;
