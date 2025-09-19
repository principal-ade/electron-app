import { ipcMain } from 'electron';
import { gitRepositoryWatcher } from './GitRepositoryWatcher';
import type { GitStatus } from '../../shared/types/git.types';
import { getTypedStorageManagerInstance } from '../stores/initialization';
import { StaticNamespaces } from '../storage-providers/types';
import { Repository } from '../../shared/types/repository.types';

export enum GitWatcherEvents {
  WATCH_REPOSITORY = 'git-watcher:watch',
  UNWATCH_REPOSITORY = 'git-watcher:unwatch',
  GET_STATUS = 'git-watcher:get-status',
  GET_ALL_STATUSES = 'git-watcher:get-all-statuses',
  REFRESH_STATUS = 'git-watcher:refresh-status',
  STATUS_UPDATE = 'git:status-update', // Event sent to renderer
}

export function registerGitWatcherHandlers(): void {
  // Listen for local-clone-missing events and automatically remove them
  gitRepositoryWatcher.on('local-clone-missing', async ({ repoPath }) => {
    console.log(`[GitWatcher] Handling missing local clone: ${repoPath}`);

    try {
      const typedManager = await getTypedStorageManagerInstance();

      // Get all repository keys
      const keysResult = await typedManager.keys(StaticNamespaces.REPOSITORIES);
      const repoKeys = keysResult.filter((key) => key.startsWith('repos_'));

      // Find the repository that contains this local clone
      for (const key of repoKeys) {
        const repoResult = await typedManager.get(
          key,
          StaticNamespaces.REPOSITORIES,
        );

        if (repoResult.success && repoResult.data) {
          const repo = repoResult.data as Repository;

          if (repo.localClones && repo.localClones.length > 0) {
            const hasThisClone = repo.localClones.some(
              (clone) => clone.path === repoPath,
            );

            if (hasThisClone) {
              console.log(
                `[GitWatcher] Removing missing local clone from repository: ${repo.name}`,
              );

              // Filter out the missing clone
              const updatedClones = repo.localClones.filter(
                (clone) => clone.path !== repoPath,
              );

              // Update the repository
              const updatedRepo = {
                ...repo,
                localClones: updatedClones,
              };

              await typedManager.set(
                key,
                updatedRepo,
                StaticNamespaces.REPOSITORIES,
              );

              // Broadcast the update
              const { BrowserWindow } = require('electron');
              BrowserWindow.getAllWindows().forEach(
                (window: Electron.BrowserWindow) => {
                  window.webContents.send('repository:updated', updatedRepo);
                },
              );

              break;
            }
          }
        }
      }
    } catch (error) {
      console.error(
        '[GitWatcher] Failed to handle missing local clone:',
        error,
      );
    }
  });
  // Start watching a repository
  ipcMain.handle(
    GitWatcherEvents.WATCH_REPOSITORY,
    async (_event, repoPath: string) => {
      try {
        await gitRepositoryWatcher.watchRepository(repoPath);
        return { success: true };
      } catch (error) {
        console.error('[GitWatcher] Failed to watch repository:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Stop watching a repository
  ipcMain.handle(
    GitWatcherEvents.UNWATCH_REPOSITORY,
    async (_event, repoPath: string) => {
      try {
        await gitRepositoryWatcher.unwatchRepository(repoPath);
        return { success: true };
      } catch (error) {
        console.error('[GitWatcher] Failed to unwatch repository:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Get current status for a repository
  ipcMain.handle(
    GitWatcherEvents.GET_STATUS,
    async (_event, repoPath: string): Promise<GitStatus | null> => {
      try {
        const status = gitRepositoryWatcher.getCurrentStatus(repoPath);
        return status || null;
      } catch (error) {
        console.error('[GitWatcher] Failed to get status:', error);
        return null;
      }
    },
  );

  // Get all current statuses
  ipcMain.handle(
    GitWatcherEvents.GET_ALL_STATUSES,
    async (): Promise<Record<string, GitStatus>> => {
      try {
        const repos = gitRepositoryWatcher.getWatchedRepositories();
        const statuses: Record<string, GitStatus> = {};

        for (const repo of repos) {
          const status = gitRepositoryWatcher.getCurrentStatus(repo);
          if (status) {
            statuses[repo] = status;
          }
        }

        return statuses;
      } catch (error) {
        console.error('[GitWatcher] Failed to get all statuses:', error);
        return {};
      }
    },
  );

  // Manually refresh status for a repository
  ipcMain.handle(
    GitWatcherEvents.REFRESH_STATUS,
    async (_event, repoPath: string): Promise<GitStatus | null> => {
      try {
        console.log(
          `[GitWatcher IPC] Refresh status requested for: ${repoPath}`,
        );
        const status = await gitRepositoryWatcher.refreshStatus(repoPath);
        console.log(
          `[GitWatcher IPC] Returning status:`,
          JSON.stringify(status, null, 2),
        );
        return status;
      } catch (error) {
        console.error('[GitWatcher IPC] Failed to refresh status:', error);
        return null;
      }
    },
  );
}

// Export cleanup function
export function cleanupGitWatcherHandlers(): void {
  gitRepositoryWatcher.destroy();
}
