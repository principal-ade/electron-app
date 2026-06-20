/**
 * useOpenWorkspaceWindow
 *
 * Institutionalizes the "open an Alexandria workspace window, with feedback"
 * flow so any control that opens one gets a consistent lifecycle:
 *
 *   idle ──open()──▶ opening ──(window first paints)──▶ opened ──▶ idle
 *
 * The transient `status` is driven by the real first-paint confirmation
 * (`WindowService.onWindowReady`), NOT by the open IPC resolving — that
 * returns before the window is visible (see WindowEvent.WINDOW_READY).
 *
 * It also exposes which workspaces/topics currently HAVE a window open
 * (`openWorkspaceIds` / `openTopicIds`, kept live off
 * `onWorkspaceWindowsChanged`) so a control can additionally show a persistent
 * "this is open" affordance — distinct from the momentary "opening…" phase.
 *
 * Edge cases handled:
 * - Reuse: if the target workspace is already open, opening just focuses the
 *   existing window and no fresh `ready-to-show` fires, so we confirm as soon
 *   as the open call resolves instead of waiting for an event that won't come.
 * - Timeout: if no ready signal arrives (e.g. the open failed silently) the
 *   status falls back to idle after OPEN_TIMEOUT_MS so the control never sticks.
 *
 * The hook is workspace-specific but agnostic to how the caller obtains the
 * workspace id: `open()` takes a resolver, so the "opening…" phase covers any
 * async work (e.g. materializing a workspace from a topic) before the window
 * is requested.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { WindowService } from '../main-process-api/WindowService';

export type OpenWindowStatus = 'idle' | 'opening' | 'opened';

/** How long the `opened` confirmation lingers before settling back to idle. */
const CONFIRM_LINGER_MS = 1200;
/** Safety net: clear `opening` if no ready/confirmation ever arrives. */
const OPEN_TIMEOUT_MS = 10000;

export interface UseOpenWorkspaceWindow {
  /**
   * Begin opening a workspace window. `resolveWorkspaceId` runs inside the
   * `opening` phase, so any async prep (create/find the workspace) is covered
   * by the feedback. No-ops if an open is already in flight on this instance.
   *
   * `key` tags this open so a single shared instance driving many controls
   * (e.g. a grid of cards) can show feedback only on the one being opened —
   * compare it against {@link activeKey}.
   */
  open: (
    resolveWorkspaceId: () => string | Promise<string>,
    key?: string,
  ) => Promise<void>;
  /** Transient lifecycle of this instance's most recent open. */
  status: OpenWindowStatus;
  /**
   * The `key` of the in-flight / just-finished open, or null when idle or no
   * key was supplied. Pair with {@link status} to drive per-target feedback.
   */
  activeKey: string | null;
  /** Workspace ids that currently have a window open. */
  openWorkspaceIds: Set<string>;
  /** Topic ids hosted by currently-open workspace windows. */
  openTopicIds: Set<string>;
}

export function useOpenWorkspaceWindow(): UseOpenWorkspaceWindow {
  const [status, setStatus] = useState<OpenWindowStatus>('idle');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Ref mirror of activeKey for synchronous reads inside `open` (the takeover
  // guard needs the current target before React flushes the state update).
  const activeKeyRef = useRef<string | null>(null);
  const setActive = useCallback((key: string | null) => {
    activeKeyRef.current = key;
    setActiveKey(key);
  }, []);
  const [openWorkspaceIds, setOpenWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [openTopicIds, setOpenTopicIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Mirror of the open set, readable synchronously from `open()` without
  // making the callback depend on (and churn with) the state value.
  const openWorkspaceIdsRef = useRef<Set<string>>(openWorkspaceIds);
  openWorkspaceIdsRef.current = openWorkspaceIds;

  // Live "what's open" state — seed once, then track open/close broadcasts.
  useEffect(() => {
    let cancelled = false;
    const apply = (list: { workspaceId?: string; topicIds?: string[] }[]) => {
      if (cancelled) return;
      setOpenWorkspaceIds(
        new Set(
          list.map((w) => w.workspaceId).filter((id): id is string => !!id),
        ),
      );
      setOpenTopicIds(new Set(list.flatMap((w) => w.topicIds ?? [])));
    };
    void WindowService.getOpenWorkspaceWindows().then(apply);
    const off = WindowService.onWorkspaceWindowsChanged(apply);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  // Pending-open bookkeeping in refs so the ready-listener/timers see current
  // values. `pending` is '' while busy-but-id-unknown (during resolve), then
  // the workspace id once known; null when idle.
  const pendingRef = useRef<string | null>(null);
  const offReadyRef = useRef<(() => void) | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tear down listeners/timers tied to the in-flight open (not the linger).
  const teardown = useCallback(() => {
    offReadyRef.current?.();
    offReadyRef.current = null;
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const confirmOpened = useCallback(() => {
    teardown();
    setStatus('opened');
    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    lingerTimerRef.current = setTimeout(() => {
      setStatus('idle');
      setActive(null);
    }, CONFIRM_LINGER_MS);
  }, [teardown, setActive]);

  const open = useCallback(
    async (
      resolveWorkspaceId: () => string | Promise<string>,
      key?: string,
    ) => {
      if (pendingRef.current !== null) {
        // An open is already in flight. Same target (or an unkeyed caller) →
        // ignore; this doubles as the double-click guard against spawning two
        // workspaces. A *different* keyed target takes over so the
        // newly-clicked control gets the feedback — the previous window is
        // still opening and will surface via the persistent open state.
        if (key === undefined || activeKeyRef.current === key) return;
        teardown();
        if (lingerTimerRef.current) {
          clearTimeout(lingerTimerRef.current);
          lingerTimerRef.current = null;
        }
      }
      pendingRef.current = ''; // busy; id not known until resolve completes
      setStatus('opening');
      setActive(key ?? null);
      try {
        const workspaceId = await resolveWorkspaceId();
        if (!workspaceId) throw new Error('no workspace id resolved');
        pendingRef.current = workspaceId;

        // Already open → focusing it won't emit a new ready-to-show.
        const alreadyOpen = openWorkspaceIdsRef.current.has(workspaceId);
        if (!alreadyOpen) {
          offReadyRef.current = WindowService.onWindowReady((state) => {
            if (state.workspaceId === pendingRef.current) confirmOpened();
          });
        }
        timeoutTimerRef.current = setTimeout(() => {
          teardown();
          setStatus('idle');
          setActive(null);
        }, OPEN_TIMEOUT_MS);

        await WindowService.openAlexandriaWorkspace({ workspaceId });
        if (alreadyOpen) confirmOpened();
      } catch (err) {
        console.error('[useOpenWorkspaceWindow] open failed', err);
        teardown();
        setStatus('idle');
        setActive(null);
      }
    },
    [confirmOpened, teardown, setActive],
  );

  // Drop everything on unmount.
  useEffect(
    () => () => {
      offReadyRef.current?.();
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    },
    [],
  );

  return { open, status, activeKey, openWorkspaceIds, openTopicIds };
}
