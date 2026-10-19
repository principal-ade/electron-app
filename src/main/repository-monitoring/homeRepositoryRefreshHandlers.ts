import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import type { WebContents } from 'electron';
import type {
  GitStatusWithFiles,
  RepositoryMonitoringManager,
} from '@principal-ai/repository-monitoring-server';
import {
  HOME_REPOSITORY_REFRESH_INTEREST,
  type HomeRepositoryRefreshInterest,
} from '../../shared/homeRepositoryRefresh';
import { HomeRepositoryRefreshScheduler } from './HomeRepositoryRefreshScheduler';

/**
 * Own refresh interest in main, so multiple windows share one queue and a
 * crashed renderer cannot leave polling running.
 */
export function registerHomeRepositoryRefreshHandlers(
  manager: RepositoryMonitoringManager,
  publish: (status: GitStatusWithFiles) => void,
): void {
  const scheduler = new HomeRepositoryRefreshScheduler(
    (path) => manager.refreshGitStatus(path),
    publish,
    (path, error) =>
      console.warn('[HomeRepositoryRefresh] Refresh failed:', path, error),
  );
  const windows = new Map<
    number,
    {
      sender: WebContents;
      interests: Map<string, HomeRepositoryRefreshInterest>;
      cleanup: () => void;
    }
  >();

  ipcMain.handle(
    HOME_REPOSITORY_REFRESH_INTEREST,
    (event, interest: HomeRepositoryRefreshInterest) => {
      if (
        !interest ||
        typeof interest.consumerId !== 'string' ||
        typeof interest.visible !== 'boolean' ||
        !Array.isArray(interest.repoPaths) ||
        !interest.repoPaths.every(
          (path) => typeof path === 'string' && path.length > 0,
        )
      ) {
        throw new Error('Invalid Home repository refresh interest');
      }
      const { sender } = event;
      const window = BrowserWindow.fromWebContents(sender);
      if (!window || window.isDestroyed() || sender.isDestroyed()) return [];
      let client = windows.get(sender.id);
      if (!client) {
        const interests = new Map<string, HomeRepositoryRefreshInterest>();
        const updateVisibility = () => {
          for (const current of interests.values()) {
            scheduler.setConsumer(
              `${sender.id}:${current.consumerId}`,
              current.repoPaths,
              current.visible && window.isVisible() && !window.isMinimized(),
            );
          }
        };
        const cleanup = () => {
          for (const id of interests.keys()) {
            scheduler.removeConsumer(`${sender.id}:${id}`);
          }
          interests.clear();
          windows.delete(sender.id);
          window.removeListener('show', updateVisibility);
          window.removeListener('hide', updateVisibility);
          window.removeListener('minimize', updateVisibility);
          window.removeListener('restore', updateVisibility);
          sender.removeListener('destroyed', cleanup);
          sender.removeListener('render-process-gone', cleanup);
          sender.removeListener('did-navigate', cleanup);
        };
        client = { sender, interests, cleanup };
        windows.set(sender.id, client);
        window.on('show', updateVisibility);
        window.on('hide', updateVisibility);
        window.on('minimize', updateVisibility);
        window.on('restore', updateVisibility);
        sender.on('destroyed', cleanup);
        sender.on('render-process-gone', cleanup);
        sender.on('did-navigate', cleanup);
      }
      if (interest.repoPaths.length)
        client.interests.set(interest.consumerId, interest);
      else client.interests.delete(interest.consumerId);
      scheduler.setConsumer(
        `${sender.id}:${interest.consumerId}`,
        interest.repoPaths,
        interest.visible && window.isVisible() && !window.isMinimized(),
      );
      return scheduler.getStatuses(interest.repoPaths);
    },
  );

  const observeStatus = (status: GitStatusWithFiles) =>
    scheduler.observeStatus(status);
  const suspend = () => scheduler.setSuspended(true);
  const resume = () => scheduler.setSuspended(false);
  manager.on('git-status-changed', observeStatus);
  powerMonitor.on('suspend', suspend);
  powerMonitor.on('resume', resume);
  app.once('will-quit', () => {
    scheduler.dispose();
    for (const client of [...windows.values()]) client.cleanup();
    manager.removeListener('git-status-changed', observeStatus);
    powerMonitor.removeListener('suspend', suspend);
    powerMonitor.removeListener('resume', resume);
    ipcMain.removeHandler(HOME_REPOSITORY_REFRESH_INTEREST);
  });
}
