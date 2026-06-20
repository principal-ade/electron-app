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
 */
export type PublishedAvailability = 'pending' | 'unavailable' | 'available' | 'error';

export interface UsePublishedTrailsResult {
  availability: PublishedAvailability;
  entries: SharedTrailIndexEntry[];
  origin: TrailListSharedResult['origin'] | null;
  errorMessage: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hydrate: (id: string) => Promise<FileCityTrailFetchSharedResult | null>;
  /**
   * Per-session map from local trail id → web-ade publish URL. Populated by
   * `recordPublish` after a local publish succeeds.
   */
  publishedUrlByLocalId: Map<string, string>;
  recordPublish: (localId: string, url: string) => void;
}

export function usePublishedTrails(
  repositoryPath: string | null,
): UsePublishedTrailsResult {
  const [availability, setAvailability] = useState<PublishedAvailability>('pending');
  const [entries, setEntries] = useState<SharedTrailIndexEntry[]>([]);
  const [origin, setOrigin] = useState<
    TrailListSharedResult['origin'] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishedUrlByLocalId, setPublishedUrlByLocalId] = useState<
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
    setPublishedUrlByLocalId(new Map());
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
        console.error('[usePublishedTrails] fetchShared failed', err);
        throw err;
      }
    },
    [origin],
  );

  const recordPublish = useCallback((localId: string, url: string) => {
    setPublishedUrlByLocalId((prev) => {
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
    publishedUrlByLocalId,
    recordPublish,
  };
}
