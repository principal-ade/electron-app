/**
 * useOpenRepositoryWindows
 *
 * Tracks which repository / dev-workspace windows currently have a window open,
 * seed once from
 * `WindowService.getOpenRepositoryWindows()`, then stay live off the
 * `onRepositoryWindowsChanged` broadcast (which carries the full open list on
 * every open/close).
 *
 * Dev-workspace windows carry a `localPath` (the repo path); legacy
 * repo-manager windows carry only a `remoteUrl`. The home view opens
 * dev-workspace windows, so callers key off `localPath`.
 */

import { useEffect, useState } from 'react';
import {
  WindowService,
  type RepositoryWindowState,
} from '../main-process-api/WindowService';

export function useOpenRepositoryWindows(): RepositoryWindowState[] {
  const [openRepoWindows, setOpenRepoWindows] = useState<
    RepositoryWindowState[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const apply = (list: RepositoryWindowState[]) => {
      if (cancelled) return;
      setOpenRepoWindows(list);
    };
    void WindowService.getOpenRepositoryWindows().then(apply);
    const off = WindowService.onRepositoryWindowsChanged(apply);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return openRepoWindows;
}
