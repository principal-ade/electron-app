/**
 * useDrawingsHost
 *
 * The Drawings surface's host glue, run for the lifetime of `WorkspaceShell`.
 * It is the only writer to the shared tab bucket for drawings: it turns the
 * local-bus `drawing:*` events (emitted by `DrawingsLeftPanel` and
 * `DrawingTabContent`) into bucket mutations.
 *
 * - `drawing:open` → open/focus a drawing tab.
 * - `drawing:saved` → rewrite that tab's `drawingId`/`path`/label (a new
 *   drawing's `new-<uuid>` id becomes the real file id, so later opens dedup).
 * - `drawing:delete-requested` → delete the file, close the tab, then re-emit
 *   `drawing:deleted` so the list rescans.
 */
import { useEffect, useRef } from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { FileSystemService } from '../main-process-api/FileSystemService';
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from '../principal-window/PortalTabsContext';
import type { DrawingTab } from '../events/portalTabs';
import {
  DRAWING_EVENTS,
  type DrawingOpenPayload,
  type DrawingSavedPayload,
  type DrawingDeleteRequestedPayload,
  type DrawingDeletedPayload,
} from './drawingsStorage';

export function useDrawingsHost({ events }: { events: PanelEventEmitter }): void {
  const { openDrawing, setTabs, setActiveTabId, tabs, activeTabId } =
    useWorkspaceTabs();

  // Refs so the delete handler can read current tabs/active without resubscribing.
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  });

  useEffect(() => {
    const handleOpen = (event: { payload: DrawingOpenPayload }) => {
      openDrawing(event.payload);
    };

    const handleSaved = (event: { payload: DrawingSavedPayload }) => {
      const { tabId, drawingId, path, name } = event.payload;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? ({ ...(t as DrawingTab), drawingId, path, name, label: name } as WorkspaceTab)
            : t,
        ),
      );
    };

    const handleDeleteRequested = async (event: {
      payload: DrawingDeleteRequestedPayload;
    }) => {
      const { drawingId, path } = event.payload;
      try {
        await FileSystemService.deleteFile(path);
      } catch (err) {
        console.error('[useDrawingsHost] Failed to delete drawing:', err);
        return;
      }
      const openTab = tabsRef.current.find(
        (t) =>
          t.contentType === 'drawing' &&
          (t as DrawingTab).drawingId === drawingId,
      );
      if (openTab) {
        setTabs((prev) => prev.filter((t) => t.id !== openTab.id));
        if (activeTabIdRef.current === openTab.id) {
          const remaining = tabsRef.current.filter((t) => t.id !== openTab.id);
          setActiveTabId(remaining[remaining.length - 1]?.id ?? 'activity-feed');
        }
      }
      events.emit<DrawingDeletedPayload>({
        type: DRAWING_EVENTS.deleted,
        source: 'drawings-host',
        timestamp: Date.now(),
        payload: { drawingId },
      });
    };

    events.on(DRAWING_EVENTS.open, handleOpen);
    events.on(DRAWING_EVENTS.saved, handleSaved);
    events.on(DRAWING_EVENTS.deleteRequested, handleDeleteRequested);
    return () => {
      events.off(DRAWING_EVENTS.open, handleOpen);
      events.off(DRAWING_EVENTS.saved, handleSaved);
      events.off(DRAWING_EVENTS.deleteRequested, handleDeleteRequested);
    };
  }, [events, openDrawing, setTabs, setActiveTabId]);
}
