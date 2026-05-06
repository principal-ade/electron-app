import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrailShareError,
  type FileCityTrailFetchSharedResult,
  type SharedTrailIndexEntry,
  type TrailListSharedResult,
} from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailShareService } from '../../services/TrailShareService';

/**
 * `unavailable` — no GitHub remote on the repo OR no GitHub token in storage.
 * The panel hides the section silently in this state since there's nothing
 * actionable to surface.
 *
 * `error` — listing reached the network/web-ade layer and failed (e.g.
 * `NO_REPO_ACCESS`). The panel shows the section header with a retry.
 *
 * Parallel to `useSequenceDiagramShares`.
 */
export type SharedAvailability = 'pending' | 'unavailable' | 'available' | 'error';

export interface UseTrailSharesResult {
  availability: SharedAvailability;
  entries: SharedTrailIndexEntry[];
  origin: TrailListSharedResult['origin'] | null;
  errorMessage: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hydrate: (id: string) => Promise<FileCityTrailFetchSharedResult | null>;
  /**
   * Per-session map from local trail id → web-ade share URL. Populated by
   * `recordShare` after a local share succeeds.
   */
  sharedUrlByLocalId: Map<string, string>;
  recordShare: (localId: string, url: string) => void;
}

export function useTrailShares(
  repositoryPath: string | null,
): UseTrailSharesResult {
  const [availability, setAvailability] = useState<SharedAvailability>('pending');
  const [entries, setEntries] = useState<SharedTrailIndexEntry[]>([]);
  const [origin, setOrigin] = useState<
    TrailListSharedResult['origin'] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharedUrlByLocalId, setSharedUrlByLocalId] = useState<
    Map<string, string>
  >(() => new Map());
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!repositoryPath) {
      setAvailability('unavailable');
      setEntries([]);
      setOrigin(null);
      setErrorMessage(null);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const result = await TrailShareService.listShared({ repositoryPath });
      if (seq !== seqRef.current) return;
      setEntries(result.entries);
      setOrigin(result.origin);
      setErrorMessage(null);
      setAvailability('available');
    } catch (err) {
      if (seq !== seqRef.current) return;
      if (err instanceof TrailShareError) {
        if (err.code === 'NO_GITHUB_REMOTE' || err.code === 'NO_GITHUB_TOKEN') {
          setAvailability('unavailable');
          setEntries([]);
          setOrigin(null);
          setErrorMessage(null);
          return;
        }
        setAvailability('error');
        setEntries([]);
        setErrorMessage(err.message);
        return;
      }
      setAvailability('error');
      setEntries([]);
      setErrorMessage(
        err instanceof Error ? err.message : 'Listing shared trails failed.',
      );
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [repositoryPath]);

  useEffect(() => {
    setSharedUrlByLocalId(new Map());
    refresh();
  }, [refresh]);

  const hydrate = useCallback(
    async (id: string): Promise<FileCityTrailFetchSharedResult | null> => {
      if (!origin) return null;
      try {
        return await TrailShareService.fetchShared(
          origin.owner,
          origin.repo,
          id,
        );
      } catch (err) {
        console.error('[useTrailShares] fetchShared failed', err);
        throw err;
      }
    },
    [origin],
  );

  const recordShare = useCallback((localId: string, url: string) => {
    setSharedUrlByLocalId((prev) => {
      const next = new Map(prev);
      next.set(localId, url);
      return next;
    });
  }, []);

  return {
    availability,
    entries,
    origin,
    errorMessage,
    loading,
    refresh,
    hydrate,
    sharedUrlByLocalId,
    recordShare,
  };
}
