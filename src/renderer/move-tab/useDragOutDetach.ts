/**
 * Drag-out detection for workspace tabs.
 *
 * The tab library owns reorder drags but exposes no "dropped outside" callback.
 * Its tabs are plain draggable elements with `data-tab-id`, so we can observe
 * the native drag lifecycle without patching the library:
 *
 * - `dragstart` records the tab only when it is a detachable kind.
 * - `dragleave` with a null `relatedTarget` means the pointer left the window.
 * - `dragend` detaches only if the drag left the window (or ended clearly
 *   outside the viewport). Reorders and canceled drags end inside and are left
 *   to the library.
 */

import { useEffect, useRef } from 'react';
import type { WorkspaceTab } from '../principal-window/PortalTabsContext';
import { toDetachableTabDescriptor } from './detachedTabDescriptor';

export interface DragRelease {
  x: number;
  y: number;
  leftWindow: boolean;
  width: number;
  height: number;
}

/**
 * `leftWindow` is the reliable signal (dragleave with no related target).
 * Coordinates are a fallback for environments that skip that event; only
 * clearly out-of-bounds values count so a drop in the window corner is not
 * mistaken for a detach.
 */
export function isDragReleaseOutsideWindow(release: DragRelease): boolean {
  if (release.leftWindow) return true;
  if (!Number.isFinite(release.x) || !Number.isFinite(release.y)) return false;
  return (
    release.x < 0 ||
    release.y < 0 ||
    release.x > release.width ||
    release.y > release.height
  );
}

export function useDragOutDetach({
  tabs,
  onDragOut,
}: {
  tabs: WorkspaceTab[];
  onDragOut: (tabId: string) => void;
}): void {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onDragOutRef = useRef(onDragOut);
  onDragOutRef.current = onDragOut;

  useEffect(() => {
    let trackedTabId: string | null = null;
    let leftWindow = false;

    const handleDragStart = (event: DragEvent) => {
      leftWindow = false;
      const target = event.target;
      if (!(target instanceof Element)) {
        trackedTabId = null;
        return;
      }
      const tabId = target
        .closest('[data-tab-id]')
        ?.getAttribute('data-tab-id');
      if (!tabId) {
        trackedTabId = null;
        return;
      }
      trackedTabId = toDetachableTabDescriptor(
        tabsRef.current.find((tab) => tab.id === tabId),
      )
        ? tabId
        : null;
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!trackedTabId) return;
      if (event.relatedTarget === null) leftWindow = true;
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!trackedTabId) return;
      // Re-entering the document means the release is inside again.
      if (event.relatedTarget === null) leftWindow = false;
    };

    const handleDragEnd = (event: DragEvent) => {
      const tabId = trackedTabId;
      const hadLeftWindow = leftWindow;
      trackedTabId = null;
      leftWindow = false;
      if (!tabId) return;
      const outside = isDragReleaseOutsideWindow({
        x: event.clientX,
        y: event.clientY,
        leftWindow: hadLeftWindow,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      if (outside) onDragOutRef.current(tabId);
    };

    window.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('dragleave', handleDragLeave, true);
    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragend', handleDragEnd, true);
    return () => {
      window.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
      window.removeEventListener('dragenter', handleDragEnter, true);
      window.removeEventListener('dragend', handleDragEnd, true);
    };
  }, []);
}
