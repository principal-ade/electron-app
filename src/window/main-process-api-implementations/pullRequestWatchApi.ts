import { ipcRenderer } from 'electron';
import {
  PullRequestWatchEvents,
  type PullRequestWatchAPI,
  type PullRequestWatchResult,
  type WatchedPullRequest,
} from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';

export const pullRequestWatchAPI: PullRequestWatchAPI = {
  list: async (): Promise<WatchedPullRequest[]> =>
    ipcRenderer.invoke(PullRequestWatchEvents.LIST),

  watch: async (target: string): Promise<PullRequestWatchResult> =>
    ipcRenderer.invoke(PullRequestWatchEvents.WATCH, target),

  unwatch: async (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(PullRequestWatchEvents.UNWATCH, id),

  refresh: async (id?: string): Promise<WatchedPullRequest[]> =>
    ipcRenderer.invoke(PullRequestWatchEvents.REFRESH, id),

  onChanged: (callback: (pullRequests: WatchedPullRequest[]) => void) => {
    const subscription = (
      _event: Electron.IpcRendererEvent,
      pullRequests: WatchedPullRequest[],
    ) => callback(pullRequests);
    ipcRenderer.on(PullRequestWatchEvents.CHANGED, subscription);
    return () =>
      ipcRenderer.removeListener(PullRequestWatchEvents.CHANGED, subscription);
  },
};
