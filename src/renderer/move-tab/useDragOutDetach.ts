/**
 * Drag-out detection for workspace tabs.
 *
 * The tab library owns reorder drags but exposes no "dropped outside" callback.
 * Its tabs are plain draggable elements with `data-tab-id`, so we can observe
 * the native drag lifecycle without patching the library:
 *
 * - `dragstart` records the tab (and whether it is a detachable kind) and
 *   swaps in a card-shaped drag image so the drag reads as "carrying a tab".
 * - `dragleave` with a null `relatedTarget` means the pointer left the window.
 * - `dragend` detaches only if the drag left the window (or ended clearly
 *   outside the viewport). Reorders and canceled drags end inside and are left
 *   to the library.
 *
 * Non-detachable tabs are tracked too, but only to report state: the host can
 * explain why nothing happens instead of silently ignoring the release.
 */

import { useEffect, useRef } from 'react';
import type { WorkspaceTab } from '../principal-window/PortalTabsContext';
import type { DetachedTabDropPoint } from '../../shared/detachedTab';
import { toDetachableTabDescriptor } from './detachedTabDescriptor';

export interface DragRelease {
  x: number;
  y: number;
  leftWindow: boolean;
  width: number;
  height: number;
}

/** Live state of a tab drag, for hosts that want to show feedback. */
export interface TabDragState {
  tabId: string;
  label: string;
  /** Whether releasing outside the window would open a new window. */
  detachable: boolean;
  /** The pointer is currently outside this window. */
  outside: boolean;
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

/** Message shown while a tab drag is outside the window, or null for none. */
export function describeTabDrag(state: TabDragState | null): string | null {
  if (!state || !state.outside) return null;
  return state.detachable
    ? `Release to open "${state.label}" in a new window`
    : `"${state.label}" can't be moved to its own window`;
}

/**
 * Build the element used as the drag image: a copy of the tab itself (so it
 * inherits the strip's theme) framed as a floating card. The element must be
 * in the document when `setDragImage` runs; the caller removes it afterwards.
 */
function createDragCard(tabElement: Element): HTMLElement | null {
  if (!(tabElement instanceof HTMLElement)) return null;
  const clone = tabElement.cloneNode(true) as HTMLElement;
  clone.style.opacity = '1';
  clone.style.margin = '0';
  clone.style.width = `${tabElement.offsetWidth}px`;
  const card = document.createElement('div');
  card.setAttribute('aria-hidden', 'true');
  card.style.position = 'fixed';
  card.style.top = '-1000px';
  card.style.left = '-1000px';
  card.style.pointerEvents = 'none';
  card.style.borderRadius = '6px';
  card.style.overflow = 'hidden';
  card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
  card.style.background = getComputedStyle(tabElement).backgroundColor;
  card.appendChild(clone);
  document.body.appendChild(card);
  return card;
}

export function useDragOutDetach({
  tabs,
  onDragOut,
  onDragStateChange,
}: {
  tabs: WorkspaceTab[];
  /** Called when a detachable tab is released outside the window. */
  onDragOut: (tabId: string, dropPoint: DetachedTabDropPoint) => void;
  /**
   * Called as a tab drag starts, crosses the window edge, and ends (`null`).
   * Fires for non-detachable tabs too so the host can explain the no-op.
   */
  onDragStateChange?: (state: TabDragState | null) => void;
}): void {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onDragOutRef = useRef(onDragOut);
  onDragOutRef.current = onDragOut;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  useEffect(() => {
    let tracked: TabDragState | null = null;

    const publish = (next: TabDragState | null) => {
      tracked = next;
      onDragStateChangeRef.current?.(next);
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        publish(null);
        return;
      }
      const tabElement = target.closest('[data-tab-id]');
      const tabId = tabElement?.getAttribute('data-tab-id');
      const tab = tabId
        ? tabsRef.current.find((candidate) => candidate.id === tabId)
        : undefined;
      if (!tabElement || !tabId || !tab) {
        publish(null);
        return;
      }

      if (event.dataTransfer) {
        const card = createDragCard(tabElement);
        if (card) {
          // Grab the card near its top-left, like lifting a tab by its label.
          event.dataTransfer.setDragImage(card, 16, 14);
          // The browser snapshots the image synchronously; the element only
          // needs to survive until the next frame.
          requestAnimationFrame(() => card.remove());
        }
      }

      publish({
        tabId,
        label: tab.label,
        detachable: toDetachableTabDescriptor(tab) !== null,
        outside: false,
      });
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!tracked || tracked.outside) return;
      if (event.relatedTarget === null) publish({ ...tracked, outside: true });
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!tracked || !tracked.outside) return;
      // Re-entering the document means the release is inside again.
      if (event.relatedTarget === null) publish({ ...tracked, outside: false });
    };

    const handleDragEnd = (event: DragEvent) => {
      const state = tracked;
      publish(null);
      if (!state) return;
      const outside = isDragReleaseOutsideWindow({
        x: event.clientX,
        y: event.clientY,
        leftWindow: state.outside,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      if (outside && state.detachable) {
        onDragOutRef.current(state.tabId, {
          screenX: event.screenX,
          screenY: event.screenY,
        });
      }
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
