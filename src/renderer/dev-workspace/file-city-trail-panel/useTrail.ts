import { useCallback, useEffect, useState } from 'react';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TrailService } from '../../services/TrailService';

export interface UseTrailResult {
  payload: TrailPayload | null;
  clear: () => void;
}

/**
 * Subscribes to trail payloads broadcast from the main process via
 * `TrailService`. Filters by `repositoryPath` so a panel only sees the trail
 * meant for its repo.
 *
 * Trails do NOT carry `repositoryPath` on the portable payload — the host
 * keeps it on the broadcast envelope. See `TrailPayloadSetEnvelope`.
 */
export function useTrail(repositoryPath: string | null): UseTrailResult {
  const [payload, setPayload] = useState<TrailPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    TrailService.getCurrent(repositoryPath ?? undefined).then((current) => {
      if (cancelled) return;
      if (current) setPayload(current);
    });

    const offSet = TrailService.onPayloadSet(({ payload: next, repositoryPath: nextRepo }) => {
      // Transient broadcasts (no repositoryPath) target every panel; bucketed
      // broadcasts only the matching one.
      if (nextRepo && nextRepo !== repositoryPath) return;
      setPayload(next);
    });

    const offCleared = TrailService.onPayloadCleared((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      setPayload(null);
    });

    return () => {
      cancelled = true;
      offSet();
      offCleared();
    };
  }, [repositoryPath]);

  const clear = useCallback(() => setPayload(null), []);

  return { payload, clear };
}
