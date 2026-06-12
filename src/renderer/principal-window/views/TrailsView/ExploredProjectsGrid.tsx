import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';

/**
 * One repo card in the "Explored Projects" grid. Carries the repo identity
 * plus that repo's newest trail (the click target) and its total trail count.
 */
export interface ExploredProjectRepoEntry {
  repo: { path: string; label: string; ownerLogin?: string };
  trail: TrailIndexEntry;
  trailCount: number;
}

/**
 * Resolved per-repo coverage. `undefined` = still resolving (card shimmers);
 * `null` = resolved but the repo tree wasn't cached, so the metric is hidden.
 */
type RepoCoverage = { covered: number; total: number; pct: number };

/**
 * Per-repo "percentage explored" for the landing cards: distinct files
 * touched by *every* saved trail in the repo, over the repo's total file
 * count. `undefined` = still resolving (card shimmers); `null` = resolved
 * but the repo tree wasn't cached, so we can't compute a denominator.
 */
function useRepoCardCoverage(
  entries: ExploredProjectRepoEntry[],
  recentTrails: TrailIndexEntry[],
): Map<string, RepoCoverage | null> {
  const [coverage, setCoverage] = useState<Map<string, RepoCoverage | null>>(
    () => new Map(),
  );
  useEffect(() => {
    if (entries.length === 0) {
      setCoverage(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const { repo } of entries) {
        if (cancelled) return;
        // Total files — cache-only; null when the repo has never been
        // opened in the app (tree isn't warm).
        let tree;
        try {
          tree = await RepositoryMonitoringService.getFileTree(repo.path);
        } catch {
          tree = null;
        }
        if (cancelled) return;
        if (!tree) {
          setCoverage((prev) => {
            const next = new Map(prev);
            next.set(repo.path, null);
            return next;
          });
          continue;
        }
        const treePaths = new Set(tree.allFiles.map((f) => f.relativePath));
        const trailIds = recentTrails
          .filter((t) => t.repositoryPath === repo.path)
          .map((t) => t.id);
        const payloads = await Promise.all(
          trailIds.map((id) => TrailLibraryService.load(id).catch(() => null)),
        );
        if (cancelled) return;
        // Union of marker source paths across all the repo's trails,
        // intersected with the tree so stale paths from renamed/deleted
        // files don't inflate the count.
        const covered = new Set<string>();
        for (const payload of payloads) {
          if (!payload) continue;
          for (const marker of payload.markers) {
            if (marker.sourcePath && treePaths.has(marker.sourcePath)) {
              covered.add(marker.sourcePath);
            }
          }
        }
        const total = tree.stats.totalFiles;
        const pct = total > 0 ? (covered.size / total) * 100 : 0;
        setCoverage((prev) => {
          const next = new Map(prev);
          next.set(repo.path, { covered: covered.size, total, pct });
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, recentTrails]);
  return coverage;
}

export interface ExploredProjectsGridProps {
  /** One entry per distinct repo, in display order. */
  entries: ExploredProjectRepoEntry[];
  /**
   * Full recent-trail list — used to compute each repo's file coverage
   * (union of marker source paths across all the repo's trails).
   */
  recentTrails: TrailIndexEntry[];
  /** Fired when a repo card is clicked or activated via keyboard. */
  onOpenRepo: (entry: ExploredProjectRepoEntry) => void;
}

/**
 * The "Explored Projects" repo-card grid. Each card shows the repo's
 * avatar/icon, its trail count, a hover-revealed "N of M files explored"
 * sub-label, and an always-visible coverage progress bar. Self-contained:
 * it resolves coverage internally from {@link recentTrails}. Used on both
 * the Trails landing screen and the Home dashboard so the cards stay in sync.
 */
export function ExploredProjectsGrid({
  entries,
  recentTrails,
  onOpenRepo,
}: ExploredProjectsGridProps) {
  const { theme } = useTheme();
  const coverageByRepo = useRepoCardCoverage(entries, recentTrails);

  return (
    <>
      {/* Hover styles for the repo cards below — render once. */}
      <style>{`
        .trail-idea-card {
          border-color: transparent !important;
          transition: border-color 150ms ease;
        }
        .trail-idea-card:hover {
          border-color: ${theme.colors.primary} !important;
        }
        .trail-card-sub {
          opacity: 0;
          transition: opacity 150ms ease;
        }
        .trail-idea-card:hover .trail-card-sub {
          opacity: 1;
        }
        .trail-card-shimmer {
          background: linear-gradient(
            90deg,
            ${theme.colors.border} 25%,
            ${theme.colors.backgroundSecondary} 50%,
            ${theme.colors.border} 75%
          );
          background-size: 200% 100%;
          animation: trail-card-shimmer 1.4s ease infinite;
          border-radius: 4px;
        }
        @keyframes trail-card-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 24,
          justifyContent: 'center',
        }}
      >
        {entries.map((entry) => {
          const coverage = coverageByRepo.get(entry.repo.path);
          return (
            <div
              key={entry.repo.path}
              role="button"
              tabIndex={0}
              className="trail-idea-card"
              title={`Open the most recent trail in ${entry.repo.label}`}
              onClick={() => onOpenRepo(entry)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenRepo(entry);
                }
              }}
              style={{
                position: 'relative',
                flex: '0 1 300px',
                width: '100%',
                maxWidth: 300,
                minHeight: 100,
                padding: '24px 20px',
                borderRadius: 10,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 12,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {entry.repo.ownerLogin ? (
                  <img
                    src={`https://github.com/${entry.repo.ownerLogin}.png?size=128`}
                    alt={entry.repo.ownerLogin}
                    width={64}
                    height={64}
                    style={{
                      borderRadius: 12,
                      flex: '0 0 auto',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  />
                ) : (
                  <FolderGit2 size={52} color={theme.colors.primary} />
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[2],
                      fontWeight: theme.fontWeights.semibold,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.repo.label}
                  </div>
                  <div
                    style={{
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textTertiary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.trailCount}{' '}
                    {entry.trailCount === 1 ? 'trail' : 'trails'}
                  </div>
                </div>
              </div>
              {/* Coverage sub-label — overlaid just above the bottom
                  line, revealed on hover. Absolute so the avatar +
                  repo name stay vertically centered in the card. */}
              {coverage === undefined ? (
                <div
                  className="trail-card-shimmer trail-card-sub"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 10,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    height: 12,
                    width: 96,
                  }}
                />
              ) : coverage === null ? null : (
                <div
                  className="trail-card-sub"
                  style={{
                    position: 'absolute',
                    left: 20,
                    right: 20,
                    bottom: 8,
                    textAlign: 'center',
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textTertiary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {coverage.covered} of {coverage.total} files explored
                </div>
              )}
              {/* Always-visible explored-progress line pinned to the
                  card's bottom edge. */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  backgroundColor: theme.colors.border,
                }}
              >
                {coverage === undefined ? (
                  <div
                    className="trail-card-shimmer"
                    style={{ height: '100%', width: '100%' }}
                  />
                ) : coverage === null ? null : (
                  <div
                    style={{
                      width: `${Math.min(100, coverage.pct)}%`,
                      height: '100%',
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
