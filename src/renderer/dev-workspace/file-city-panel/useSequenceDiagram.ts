import { useCallback, useEffect, useState } from 'react';
import type { SequenceDiagramPayload } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export interface UseSequenceDiagramResult {
  payload: SequenceDiagramPayload | null;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  clear: () => void;
}

const matchesRepo = (
  payload: Pick<SequenceDiagramPayload, 'repositoryPath'>,
  repositoryPath: string | null,
): boolean => {
  if (!payload.repositoryPath) return true;
  if (!repositoryPath) return false;
  return payload.repositoryPath === repositoryPath;
};

/**
 * Subscribes to sequence-diagram payloads broadcast from the main
 * process. Filters by `repositoryPath` so a panel only displays a
 * payload meant for its repo (or any payload that omits the field).
 */
export function useSequenceDiagram(
  repositoryPath: string | null,
): UseSequenceDiagramResult {
  const [payload, setPayload] = useState<SequenceDiagramPayload | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return;

    api
      .getCurrent(repositoryPath ?? undefined)
      .then((current) => {
        if (cancelled) return;
        if (current && matchesRepo(current, repositoryPath)) {
          setPayload(current);
        }
      })
      .catch(() => {
        /* main not ready yet — IPC subscriptions below will catch later sets */
      });

    const offSet = api.onPayloadSet((next) => {
      if (!matchesRepo(next, repositoryPath)) return;
      setPayload(next);
      setSelectedEventId(null);
    });

    const offCleared = api.onPayloadCleared((info) => {
      if (info.repositoryPath && info.repositoryPath !== repositoryPath) return;
      setPayload(null);
      setSelectedEventId(null);
    });

    return () => {
      cancelled = true;
      offSet();
      offCleared();
    };
  }, [repositoryPath]);

  const clear = useCallback(() => {
    setPayload(null);
    setSelectedEventId(null);
  }, []);

  return { payload, selectedEventId, setSelectedEventId, clear };
}
