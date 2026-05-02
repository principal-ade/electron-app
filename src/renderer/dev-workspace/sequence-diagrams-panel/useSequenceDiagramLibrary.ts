import { useCallback, useEffect, useState } from 'react';
import type { SequenceDiagramIndexEntry } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { SequenceDiagramLibraryService } from '../../services/SequenceDiagramLibraryService';

export interface UseSequenceDiagramLibraryResult {
  entries: SequenceDiagramIndexEntry[];
  activeId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Subscribes to LIBRARY_CHANGED and re-lists saved sequence-diagram payloads
 * for the given repository. Filters refresh broadcasts by `repositoryPath`
 * so panels in unrelated repos don't churn.
 */
export function useSequenceDiagramLibrary(
  repositoryPath: string | null,
): UseSequenceDiagramLibraryResult {
  const [entries, setEntries] = useState<SequenceDiagramIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await SequenceDiagramLibraryService.list(
        repositoryPath ?? undefined,
      );
      setEntries(result.entries);
      setActiveId(result.activeId);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    refresh();
    const off = SequenceDiagramLibraryService.onLibraryChanged((info) => {
      // Repo-agnostic broadcasts (no path) always trigger a refresh; scoped
      // broadcasts only refresh the matching panel.
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      refresh();
    });
    return off;
  }, [refresh, repositoryPath]);

  const activate = useCallback(
    (id: string) => SequenceDiagramLibraryService.activate(id),
    [],
  );

  const remove = useCallback(
    (id: string) => SequenceDiagramLibraryService.remove(id),
    [],
  );

  return { entries, activeId, loading, refresh, activate, remove };
}
