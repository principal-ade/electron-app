import React, { useEffect, useMemo, useState } from 'react';
import type { CityData } from '@principal-ai/file-city-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import { buildCityDataFromContext } from '../../../dev-workspace/file-city-panel/buildCityDataFromContext';
import { RepoTrailCoverageCard } from './RepoTrailCoverageCard';

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
 * Resolved per-repo city + coverage. `undefined` = still resolving (card shows
 * a skeleton body); `null` = resolved but the repo tree wasn't cached (repo
 * never opened in the app), so we can't build a city.
 */
type RepoCoverageCity = {
  cityData: CityData;
  /** Repo-relative path → number of trails touching it (heat-map input). */
  coverageByPath: Map<string, number>;
};

/**
 * Per-repo coverage city for the landing cards. For each repo: pull its file
 * tree (cache-only), build the city once, load every saved trail in the repo,
 * and fold the markers' source paths into a touch-count map. The map and city
 * feed {@link RepoTrailCoverageCard}; stale marker paths are dropped at render
 * time by the minimap, so no tree intersection is needed here.
 */
function useRepoCoverageCities(
  entries: ExploredProjectRepoEntry[],
  recentTrails: TrailIndexEntry[],
): Map<string, RepoCoverageCity | null> {
  const [result, setResult] = useState<Map<string, RepoCoverageCity | null>>(
    () => new Map(),
  );
  useEffect(() => {
    if (entries.length === 0) {
      setResult(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const { repo } of entries) {
        if (cancelled) return;
        // Total files — cache-only; null when the repo has never been opened
        // in the app (tree isn't warm).
        let tree;
        try {
          tree = await RepositoryMonitoringService.getFileTree(repo.path);
        } catch {
          tree = null;
        }
        if (cancelled) return;
        if (!tree) {
          setResult((prev) => new Map(prev).set(repo.path, null));
          continue;
        }
        // Build the city once per repo. Repo-relative building paths line up
        // with the trail markers' repo-relative source paths.
        const cityData = await buildCityDataFromContext({
          fileTree: tree,
          repositoryPath: repo.path,
        });
        if (cancelled) return;
        const trailIds = recentTrails
          .filter((t) => t.repositoryPath === repo.path)
          .map((t) => t.id);
        const payloads = await Promise.all(
          trailIds.map((id) => TrailLibraryService.load(id).catch(() => null)),
        );
        if (cancelled) return;
        // path → number of trails touching it, deduped per trail so a trail
        // touching a path twice still counts once (mirrors useTrailFilePaths).
        const coverageByPath = new Map<string, number>();
        for (const payload of payloads) {
          if (!payload) continue;
          const seen = new Set<string>();
          for (const marker of payload.markers) {
            const p = marker.sourcePath;
            if (!p || seen.has(p)) continue;
            seen.add(p);
            coverageByPath.set(p, (coverageByPath.get(p) ?? 0) + 1);
          }
        }
        setResult((prev) =>
          new Map(prev).set(repo.path, { cityData, coverageByPath }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, recentTrails]);
  return result;
}

export interface ExploredProjectsGridProps {
  /** One entry per distinct repo, in display order. */
  entries: ExploredProjectRepoEntry[];
  /**
   * Full recent-trail list — used to compute each repo's coverage (union of
   * marker source paths across all the repo's trails).
   */
  recentTrails: TrailIndexEntry[];
  /** Fired when a repo card is clicked or activated via keyboard. */
  onOpenRepo: (entry: ExploredProjectRepoEntry) => void;
}

/**
 * The "Explored Projects" repo-card grid. Each card is a consistent square: an
 * owner/name header, a non-interactive File City minimap heat-mapping the
 * repo's all-trails coverage, and a footer with the trail count and the number
 * of files covered. Self-contained: it resolves each repo's city + coverage
 * internally from {@link recentTrails}. Used on both the Trails landing screen
 * and the Home dashboard so the cards stay in sync.
 */
export function ExploredProjectsGrid({
  entries,
  recentTrails,
  onOpenRepo,
}: ExploredProjectsGridProps) {
  const coverageByRepo = useRepoCoverageCities(entries, recentTrails);

  // Order by coverage fraction (covered ÷ total files), most-covered first.
  // Repos still resolving or without a cached tree score -1 so they fall to
  // the bottom, keeping their incoming recency order (Array.sort is stable).
  // The grid reorders as each repo's coverage resolves, then settles.
  const sortedEntries = useMemo(() => {
    const scoreByPath = new Map<string, number>();
    for (const entry of entries) {
      const resolved = coverageByRepo.get(entry.repo.path);
      if (!resolved) {
        scoreByPath.set(entry.repo.path, -1);
        continue;
      }
      const buildings = new Set(resolved.cityData.buildings.map((b) => b.path));
      let covered = 0;
      for (const [path, n] of resolved.coverageByPath) {
        if (n > 0 && buildings.has(path)) covered += 1;
      }
      const total = buildings.size;
      scoreByPath.set(entry.repo.path, total > 0 ? covered / total : 0);
    }
    return [...entries].sort(
      (a, b) =>
        (scoreByPath.get(b.repo.path) ?? -1) -
        (scoreByPath.get(a.repo.path) ?? -1),
    );
  }, [entries, coverageByRepo]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        justifyContent: 'center',
      }}
    >
      {sortedEntries.map((entry) => {
        const resolved = coverageByRepo.get(entry.repo.path);
        return (
          <RepoTrailCoverageCard
            key={entry.repo.path}
            repoLabel={entry.repo.label}
            ownerLogin={entry.repo.ownerLogin}
            cityData={resolved ? resolved.cityData : null}
            coverageByPath={resolved ? resolved.coverageByPath : undefined}
            trailCount={entry.trailCount}
            loading={resolved === undefined}
            onClick={() => onOpenRepo(entry)}
          />
        );
      })}
    </div>
  );
}
