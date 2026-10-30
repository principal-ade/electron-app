/**
 * Tabs that were detached into their own windows. Main owns the list and
 * rebroadcasts it whenever a tab is detached or its window closes, so Home can
 * show those tabs as open and focus their window instead of reopening them.
 */

import { useEffect, useState } from 'react';
import {
  WindowService,
  type DetachableTabDescriptor,
  type DetachedTabWindow,
} from '../../main-process-api/WindowService';
import type { HomeTabEntry } from './homeTabEntries';

function byTabId(
  detached: readonly DetachedTabWindow[],
): ReadonlyMap<string, DetachedTabWindow> {
  return new Map(detached.map((entry) => [entry.tab.tabId, entry]));
}

/** Detached tabs keyed by their source workspace tab id. */
export function useDetachedTabs(): ReadonlyMap<string, DetachedTabWindow> {
  const [detached, setDetached] = useState<
    ReadonlyMap<string, DetachedTabWindow>
  >(() => new Map());

  useEffect(() => {
    let disposed = false;
    const unsubscribe = WindowService.onDetachedTabsChanged((next) => {
      if (!disposed) setDetached(byTabId(next));
    });
    void WindowService.getDetachedTabs().then((initial) => {
      if (!disposed) setDetached(byTabId(initial));
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return detached;
}

/**
 * The Home rail entry for a detached tab, matching what `entryFromTab` builds
 * for the same tab when it is open in this window. C4 sketches have no Home
 * row, so they map to null.
 */
export function detachedTabEntry(
  tab: DetachableTabDescriptor,
): HomeTabEntry | null {
  if (tab.kind === 'local-topic' && tab.topicId) {
    return {
      id: tab.tabId,
      kind: 'topic',
      label: tab.label,
      topicId: tab.topicId,
      title: tab.title,
    };
  }
  if (tab.kind === 'subsystem-model' && tab.modelId) {
    return {
      id: tab.tabId,
      kind: 'subsystem-model',
      label: tab.label,
      modelId: tab.modelId,
      title: tab.label,
    };
  }
  return null;
}
