/**
 * useHomePins
 *
 * Reads and writes the Home rail's pins:
 *
 * - **Tab pins** (`interactiveShell.homePinnedTabs`) keep a tab entry in the
 *   rail after its tab closes. Repo-rooted tab pins collapse to an icon on the
 *   repo row; standalone ones land in the Pinned section.
 * - **Repo pins** (`interactiveShell.homePinnedRepos`) keep a repo row in the
 *   rail even when it is clean and has no open tabs. Terminals and clone
 *   profiles use their repo pin, never an individual tab pin.
 *
 * Preferences updates are deep-merged in the main process, so writing one slice
 * leaves the others untouched.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HomePinnedTab } from '../../../shared/types/userPreferences.types';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { isHomeTabPinnable } from './homeTabEntries';

export interface HomePinsState {
  /** Every pinned tab entry, whether or not its tab is open. */
  pinnedTabs: HomePinnedTab[];
  /** Ids of pinned tab entries, for O(1) membership checks while rendering. */
  pinnedTabIds: Set<string>;
  isTabPinned: (id: string) => boolean;
  /** Pin a tab entry, or unpin it when already pinned. */
  toggleTabPin: (entry: HomePinnedTab) => void;

  /** Every pinned repo key (clone path, or purl for a remote-only repo). */
  pinnedRepos: string[];
  pinnedRepoKeys: Set<string>;
  isRepoPinned: (key: string) => boolean;
  /** Pin a repo row, or unpin it when already pinned. */
  toggleRepoPin: (key: string) => void;
}

export function useHomePins(): HomePinsState {
  const [pinnedTabs, setPinnedTabs] = useState<HomePinnedTab[]>([]);
  const [pinnedRepos, setPinnedRepos] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const apply = (
      prefs: Awaited<ReturnType<typeof UserPreferencesService.getPreferences>>,
    ) => {
      if (cancelled) return;
      setPinnedTabs(prefs.interactiveShell?.homePinnedTabs ?? []);
      setPinnedRepos(prefs.interactiveShell?.homePinnedRepos ?? []);
    };

    void UserPreferencesService.getPreferences()
      .then(apply)
      .catch((error) =>
        console.error('[useHomePins] Failed to load pins:', error),
      );

    const off = UserPreferencesService.onPreferencesUpdated(apply);

    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const pinnedTabIds = useMemo(
    () => new Set(pinnedTabs.map((entry) => entry.id)),
    [pinnedTabs],
  );
  const pinnedRepoKeys = useMemo(() => new Set(pinnedRepos), [pinnedRepos]);

  const toggleTabPin = useCallback((entry: HomePinnedTab) => {
    if (!isHomeTabPinnable(entry)) return;
    setPinnedTabs((prev) => {
      const next = prev.some((p) => p.id === entry.id)
        ? prev.filter((p) => p.id !== entry.id)
        : [...prev, entry];
      void UserPreferencesService.updatePreferences({
        interactiveShell: { homePinnedTabs: next },
      }).catch((error) =>
        console.error('[useHomePins] Failed to save tab pins:', error),
      );
      return next;
    });
  }, []);

  const toggleRepoPin = useCallback((key: string) => {
    setPinnedRepos((prev) => {
      const next = prev.includes(key)
        ? prev.filter((candidate) => candidate !== key)
        : [...prev, key];
      void UserPreferencesService.updatePreferences({
        interactiveShell: { homePinnedRepos: next },
      }).catch((error) =>
        console.error('[useHomePins] Failed to save repo pins:', error),
      );
      return next;
    });
  }, []);

  const isTabPinned = useCallback(
    (id: string) => pinnedTabIds.has(id),
    [pinnedTabIds],
  );
  const isRepoPinned = useCallback(
    (key: string) => pinnedRepoKeys.has(key),
    [pinnedRepoKeys],
  );

  return {
    pinnedTabs,
    pinnedTabIds,
    isTabPinned,
    toggleTabPin,
    pinnedRepos,
    pinnedRepoKeys,
    isRepoPinned,
    toggleRepoPin,
  };
}
