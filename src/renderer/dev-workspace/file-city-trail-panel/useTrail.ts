import { useCallback, useEffect, useState } from 'react';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { TrailService } from '../../services/TrailService';
import {
  TRAIL_EVENT,
  type TrailActivatedEvent,
  type TrailClearedEvent,
} from '../trail-events';

export interface UseTrailResult {
  payload: TrailPayload | null;
  clear: () => void;
}

/**
 * Tracks the active trail payload for a repo. Updates come from two
 * sources:
 *
 * 1. **Renderer event bus** — click-driven mutations in this same window
 *    (TrailsPanel activate/clear) emit on `events` so this hook updates
 *    without round-tripping through main's IPC.
 * 2. **IPC `onPayloadSet` / `onPayloadCleared`** — pushed by HTTP route
 *    handlers via `sendToRepoWindows` for state changes initiated outside
 *    this renderer.
 *
 * Both paths apply the same repo-scoped filter.
 */
export function useTrail(
  repositoryPath: string | null,
  events?: PanelEventEmitter,
): UseTrailResult {
  const [payload, setPayload] = useState<TrailPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    TrailService.getCurrent(repositoryPath ?? undefined).then((current) => {
      if (cancelled) return;
      if (current) setPayload(current);
    });

    const matches = (nextRepo: string | undefined): boolean =>
      !nextRepo || nextRepo === repositoryPath;

    const offIpcSet = TrailService.onPayloadSet(
      ({ payload: next, repositoryPath: nextRepo }) => {
        if (!matches(nextRepo)) return;
        setPayload(next);
      },
    );

    const offIpcCleared = TrailService.onPayloadCleared((info) => {
      if (!matches(info.repositoryPath)) return;
      setPayload(null);
    });

    const offRendererActivated = events?.on<TrailActivatedEvent>(
      TRAIL_EVENT.activated,
      (event) => {
        if (!matches(event.payload.repositoryPath)) return;
        setPayload(event.payload.payload);
      },
    );

    const offRendererCleared = events?.on<TrailClearedEvent>(
      TRAIL_EVENT.cleared,
      (event) => {
        if (!matches(event.payload.repositoryPath)) return;
        setPayload(null);
      },
    );

    return () => {
      cancelled = true;
      offIpcSet();
      offIpcCleared();
      offRendererActivated?.();
      offRendererCleared?.();
    };
  }, [repositoryPath, events]);

  const clear = useCallback(() => setPayload(null), []);

  return { payload, clear };
}
