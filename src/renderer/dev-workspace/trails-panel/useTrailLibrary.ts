import { useCallback, useEffect, useState } from 'react';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailLibraryService } from '../../services/TrailLibraryService';

export interface ActivateResult {
  payload: TrailPayload;
  repositoryPath?: string;
}

export interface RemoveResult {
  found: boolean;
  wasActive: boolean;
  repositoryPath?: string;
}

export interface UseTrailLibraryResult {
  entries: TrailIndexEntry[];
  activeId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Marks a saved trail active. Resolves with the activated payload so the
   * caller can update local state and emit an in-window renderer event for
   * sibling components. Returns `null` if the id is unknown.
   */
  activate: (id: string) => Promise<ActivateResult | null>;
  /**
   * Deletes a saved trail. Resolves with the deletion outcome so the caller
   * can clear local state when the active entry was deleted.
   */
  remove: (id: string) => Promise<RemoveResult>;
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
    async (id: string): Promise<ActivateResult | null> => {
      const result = await TrailLibraryService.activate(id);
      if (!result) return null;
      setActiveId(id);
      return result;
    },
    [],
  );

  const remove = useCallback(
    async (id: string): Promise<RemoveResult> => {
      const result = await TrailLibraryService.remove(id);
      if (result.found) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setActiveId((prev) => (prev === id ? null : prev));
      }
      return result;
    },
    [],
  );

  return { entries, activeId, loading, refresh, activate, remove };
}
