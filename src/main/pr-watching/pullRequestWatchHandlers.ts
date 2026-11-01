/**
 * ipcMain handlers for the pull request watch list. The watcher broadcasts
 * `pr-watch:changed` to every window itself, so the renderer never polls.
 */

import { ipcMain } from 'electron';
import { PullRequestWatchEvents } from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';
import { getPullRequestWatcher } from './PullRequestWatcher';

export function registerPullRequestWatchHandlers(): void {
  const watcher = getPullRequestWatcher();

  ipcMain.handle(PullRequestWatchEvents.LIST, async () => watcher.list());

  ipcMain.handle(
    PullRequestWatchEvents.WATCH,
    async (_event, target: unknown) => watcher.watch(target),
  );

  ipcMain.handle(PullRequestWatchEvents.UNWATCH, async (_event, id: unknown) =>
    typeof id === 'string'
      ? watcher.unwatch(id)
      : { success: false, error: 'Invalid pull request id.' },
  );

  ipcMain.handle(PullRequestWatchEvents.REFRESH, async (_event, id?: unknown) =>
    watcher.refresh(typeof id === 'string' ? id : undefined),
  );

  watcher.start();
  console.log('[PullRequestWatch] Handlers registered');
}
