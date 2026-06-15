/**
 * Real `CommitActivityPanelActions` wiring backed by the renderer's
 * main-process-api services. Kept out of CommitActivityPanel.tsx so the
 * panel stays importable in non-Electron environments (Storybook, tests).
 */

import { GithubService } from '../main-process-api/GithubService';
import { repoActivityCardActions } from './repoActivityCardActions';
import type { CommitActivityPanelActions } from './CommitActivityPanel';

export const commitActivityPanelActions: CommitActivityPanelActions = {
  ...repoActivityCardActions,
  getOwnerActivity: (login, type) => GithubService.getOwnerActivity(login, type),
  getRepoActivity: (owner, repo) => GithubService.getRepoActivity(owner, repo),
};
