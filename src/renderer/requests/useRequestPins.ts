import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  requestDefinition,
  type CatalogRequest,
  type SavedRequest,
} from '../../shared/requests/preparedRequest';
import { BrunoService } from '../main-process-api/BrunoService';

export function useRequestPins() {
  const [catalogRequests, setCatalogRequests] = useState<CatalogRequest[]>([]);
  const savedRequests = useMemo(
    () =>
      catalogRequests
        .filter((request) => request.pinned)
        .map(requestDefinition),
    [catalogRequests],
  );
  const [requestPinError, setError] = useState<string | null>(null);
  const [requestPinBusy, setBusy] = useState(false);
  const revision = useRef(0);
  const busy = useRef(false);
  const loadSequence = useRef(0);

  const refreshSavedRequests = useCallback(async () => {
    const current = revision.current;
    const sequence = ++loadSequence.current;
    try {
      const pending = BrunoService.listRoutes();
      if (!pending) return;
      const saved = await pending;
      if (current !== revision.current || sequence !== loadSequence.current)
        return;
      setError(null);
      setCatalogRequests((previous) =>
        previous.length || saved.length ? saved : previous,
      );
    } catch {
      if (current !== revision.current || sequence !== loadSequence.current)
        return;
      setError(
        'Could not load remembered requests. Check that secure storage is available and retry.',
      );
    }
  }, []);
  useEffect(() => {
    const unsubscribe = BrunoService.onCatalogChanged(() => {
      void refreshSavedRequests();
    });
    void refreshSavedRequests();
    return unsubscribe;
  }, [refreshSavedRequests]);

  const mutate = useCallback(
    async (operation: () => Promise<unknown>, error: string) => {
      if (busy.current) return;
      busy.current = true;
      revision.current++;
      setBusy(true);
      try {
        await operation();
        setError(null);
        // Read the authoritative catalog, not a mutation snapshot that may predate
        // another window or rapidly prepared routes. Automatic retention never
        // uses this UI-only busy gate.
        await refreshSavedRequests();
      } catch {
        setError(error);
      } finally {
        busy.current = false;
        setBusy(false);
      }
    },
    [refreshSavedRequests],
  );

  const saveRequest = useCallback(
    (request: SavedRequest) =>
      mutate(
        () => BrunoService.pin(request),
        'Could not save request. Check for duplicate routes, catalog capacity, and secure storage, then retry.',
      ),
    [mutate],
  );
  const unpinRequest = useCallback(
    (id: string) =>
      mutate(
        () => BrunoService.unpin(id),
        'Could not unpin request. Check secure storage and retry.',
      ),
    [mutate],
  );
  const updateRequest = useCallback(
    (request: SavedRequest) =>
      mutate(
        () => BrunoService.updateRoute(request),
        'Could not update request. Check for duplicate routes and secure storage, then retry.',
      ),
    [mutate],
  );
  const forgetRequest = useCallback(
    (id: string) =>
      mutate(
        () => BrunoService.forgetRoute(id),
        'Could not forget request. Unpin it first, then check secure storage and retry.',
      ),
    [mutate],
  );

  return {
    savedRequests,
    catalogRequests,
    saveRequest,
    updateRequest,
    forgetRequest,
    unpinRequest,
    requestPinError,
    requestPinBusy,
    refreshSavedRequests,
  };
}
