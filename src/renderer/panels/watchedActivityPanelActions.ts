/**
 * Real `WatchedActivityPanelActions` wiring backed by the renderer's
 * main-process-api services. Kept out of WatchedActivityPanel.tsx so the
 * panel stays importable in non-Electron environments (Storybook, tests).
 */

import { GithubService } from '../main-process-api/GithubService';
import { repoActivityCardActions } from './repoActivityCardActions';
import type { WatchedActivityPanelActions } from './WatchedActivityPanel';

export const watchedActivityPanelActions: WatchedActivityPanelActions = {
  ...repoActivityCardActions,
  getOwnerActivity: (login, type) => GithubService.getOwnerActivity(login, type),
  getRepoActivity: (owner, repo) => GithubService.getRepoActivity(owner, repo),
};
