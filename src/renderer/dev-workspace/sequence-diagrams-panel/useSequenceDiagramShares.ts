import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SequenceDiagramShareError,
  type FileCitySequenceFetchSharedResult,
  type SequenceDiagramListSharedResult,
  type SharedSequenceDiagramIndexEntry,
} from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { SequenceDiagramShareService } from '../../services/SequenceDiagramShareService';

/**
 * `unavailable` — no GitHub remote on the repo OR no GitHub token in storage.
 * The panel hides the section silently in this state since there's nothing
 * actionable to surface.
 *
 * `error` — listing reached the network/web-ade layer and failed (e.g.
 * `NO_REPO_ACCESS`). The panel shows the section header with a retry.
 */
export type SharedAvailability = 'pending' | 'unavailable' | 'available' | 'error';

export interface UseSequenceDiagramSharesResult {
  availability: SharedAvailability;
  entries: SharedSequenceDiagramIndexEntry[];
  /** Origin resolved by main on the first successful list — needed for fetchShared. */
  origin: SequenceDiagramListSharedResult['origin'] | null;
  errorMessage: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Hydrate a shared payload by id. Caller activates / renders. */
  hydrate: (id: string) => Promise<FileCitySequenceFetchSharedResult | null>;
  /**
   * Per-session map from local payload id → web-ade share URL. Populated by
   * `recordShare` after a local share succeeds; used by the local row to
   * stamp a "shared" indicator and switch its action to "Copy link".
   */
  sharedUrlByLocalId: Map<string, string>;
  recordShare: (localId: string, url: string) => void;
}

export function useSequenceDiagramShares(
  repositoryPath: string | null,
): UseSequenceDiagramSharesResult {
  const [availability, setAvailability] = useState<SharedAvailability>('pending');
  const [entries, setEntries] = useState<SharedSequenceDiagramIndexEntry[]>([]);
  const [origin, setOrigin] = useState<
    SequenceDiagramListSharedResult['origin'] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Map persists across re-lists so a freshly-shared local id keeps its
  // "shared" stamp even if the listing refresh returns before recordShare
  // is called. Reset when the repo changes.
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
      const result = await SequenceDiagramShareService.listShared({
        repositoryPath,
      });
      if (seq !== seqRef.current) return;
      setEntries(result.entries);
      setOrigin(result.origin);
      setErrorMessage(null);
      setAvailability('available');
    } catch (err) {
      if (seq !== seqRef.current) return;
      if (err instanceof SequenceDiagramShareError) {
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
        err instanceof Error ? err.message : 'Listing shared diagrams failed.',
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
    async (id: string): Promise<FileCitySequenceFetchSharedResult | null> => {
      if (!origin) return null;
      try {
        return await SequenceDiagramShareService.fetchShared(
          origin.owner,
          origin.repo,
          id,
        );
      } catch (err) {
        console.error('[useSequenceDiagramShares] fetchShared failed', err);
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
