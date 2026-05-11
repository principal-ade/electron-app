import { useCallback, useEffect, useState } from 'react';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { TrailService } from '../../services/TrailService';

export interface ActivateResult {
  payload: TrailPayload;
  repositoryPath?: string;
}

export interface RemoveResult {
  found: boolean;
  repositoryPath?: string;
}

export interface UseTrailLibraryResult {
  entries: TrailIndexEntry[];
  activeId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * Resolve a saved trail by id and return the payload + repo path. The
   * caller updates local state and emits an in-window renderer event for
   * sibling components. Returns `null` if the id is unknown.
   */
  activate: (id: string) => Promise<ActivateResult | null>;
  /**
   * Delete a saved trail. Resolves with the deletion outcome.
   */
  remove: (id: string) => Promise<RemoveResult>;
}

/**
 * Subscribes to LIBRARY_CHANGED and re-lists saved trail payloads for the
 * given repository. `activeId` is tracked renderer-locally — initialized
 * from the `?openTrailId=` URL arg this window was opened with, and
 * updated when the user activates a different trail or main broadcasts
 * a PAYLOAD_SET for this repo.
 */
export function useTrailLibrary(
  repositoryPath: string | null,
): UseTrailLibraryResult {
  const [entries, setEntries] = useState<TrailIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() =>
    TrailService.getOpenTrailId(),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await TrailLibraryService.list(repositoryPath ?? undefined);
      setEntries(result.entries);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    refresh();
    const offLib = TrailLibraryService.onLibraryChanged((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      refresh();
    });
    const offSet = TrailService.onPayloadSet(({ payload, repositoryPath: nextRepo }) => {
      if (nextRepo && nextRepo !== repositoryPath) return;
      setActiveId(payload.id);
    });
    const offCleared = TrailService.onPayloadCleared(({ id, repositoryPath: nextRepo }) => {
      if (nextRepo && nextRepo !== repositoryPath) return;
      setActiveId((prev) => (prev === id ? null : prev));
    });
    return () => {
      offLib();
      offSet();
      offCleared();
    };
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
