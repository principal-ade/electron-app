import { useCallback, useEffect, useState } from 'react';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailLibraryService } from '../../services/TrailLibraryService';

export interface UseTrailLibraryResult {
  entries: TrailIndexEntry[];
  activeId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Subscribes to LIBRARY_CHANGED and re-lists saved trail payloads for the
 * given repository. Filters refresh broadcasts by `repositoryPath`.
 */
export function useTrailLibrary(
  repositoryPath: string | null,
): UseTrailLibraryResult {
  const [entries, setEntries] = useState<TrailIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await TrailLibraryService.list(repositoryPath ?? undefined);
      setEntries(result.entries);
      setActiveId(result.activeId);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    refresh();
    const off = TrailLibraryService.onLibraryChanged((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      refresh();
    });
    return off;
  }, [refresh, repositoryPath]);

  const activate = useCallback(
    (id: string) => TrailLibraryService.activate(id),
    [],
  );

  const remove = useCallback(
    (id: string) => TrailLibraryService.remove(id),
    [],
  );

  return { entries, activeId, loading, refresh, activate, remove };
}
