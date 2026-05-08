import { useEffect, useState } from 'react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailLibraryService } from '../../../services/TrailLibraryService';

export interface TrailFilePaths {
  /** Per-trail repo-relative source paths extracted from `markers[].sourcePath`. */
  byTrail: Map<string, string[]>;
  /** Aggregated path → number of trails that touch it. Drives the heat map. */
  trailCountByPath: Map<string, number>;
  loading: boolean;
}

const EMPTY: TrailFilePaths = {
  byTrail: new Map(),
  trailCountByPath: new Map(),
  loading: false,
};

export function useTrailFilePaths(
  entries: TrailIndexEntry[],
): TrailFilePaths {
  const [result, setResult] = useState<TrailFilePaths>(EMPTY);

  useEffect(() => {
    if (entries.length === 0) {
      setResult(EMPTY);
      return;
    }
    let cancelled = false;
    setResult((prev) => ({ ...prev, loading: true }));
    Promise.all(
      entries.map(async (entry) => {
        const payload = await TrailLibraryService.load(entry.id);
        const paths: string[] = [];
        if (payload) {
          for (const marker of payload.markers) {
            if (marker.sourcePath) paths.push(marker.sourcePath);
          }
        }
        return [entry.id, paths] as const;
      }),
    ).then((rows) => {
      if (cancelled) return;
      const byTrail = new Map<string, string[]>();
      const trailCountByPath = new Map<string, number>();
      for (const [id, paths] of rows) {
        byTrail.set(id, paths);
        const seen = new Set<string>();
        for (const p of paths) {
          if (seen.has(p)) continue;
          seen.add(p);
          trailCountByPath.set(p, (trailCountByPath.get(p) ?? 0) + 1);
        }
      }
      setResult({ byTrail, trailCountByPath, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  return result;
}
