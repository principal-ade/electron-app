import type {
  PullRequestWatchResult,
  WatchedPullRequest,
} from '../../shared/main-process-api-interfaces/PullRequestWatchAPI';

/**
 * Renderer wrapper over the main-process pull request watch list
 * (`window.mainProcess.pullRequestWatch`).
 */
export const PullRequestWatchService = {
  list: (): Promise<WatchedPullRequest[]> =>
    window.mainProcess.pullRequestWatch.list(),

  watch: (target: string): Promise<PullRequestWatchResult> =>
    window.mainProcess.pullRequestWatch.watch(target),

  unwatch: (id: string): Promise<{ success: boolean; error?: string }> =>
    window.mainProcess.pullRequestWatch.unwatch(id),

  refresh: (id?: string): Promise<WatchedPullRequest[]> =>
    window.mainProcess.pullRequestWatch.refresh(id),

  onChanged: (
    callback: (pullRequests: WatchedPullRequest[]) => void,
  ): (() => void) => window.mainProcess.pullRequestWatch.onChanged(callback),
};

export type { WatchedPullRequest, PullRequestWatchResult };
