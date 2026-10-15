/**
 * Real `RepoActivityCardActions` wiring backed by the renderer's
 * main-process-api services. Kept out of RepoActivityCard.tsx so the card
 * stays importable in non-Electron environments (Storybook, tests).
 *
 * Web-ADE hosted API calls have been removed. Actions that previously called
 * app.principal-ade.com now return empty stubs.
 */

import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import type {
  ExplainCommitsInput,
  ExplainCommitsResponse,
  GetTreeResponse,
} from '../../shared/tipc/webAdeRouterTypes';
import type { RepoActivityCardActions } from './RepoActivityCard';

// Stub: hosted Web-ADE API has been removed.
async function stubGetGithubTree(): Promise<GetTreeResponse> {
  return { sha: '', tree: [], truncated: false };
}

// Stub: hosted Web-ADE API has been removed.
async function stubExplainCommits(
  _input: ExplainCommitsInput,
): Promise<ExplainCommitsResponse> {
  return { text: '' };
}

export const repoActivityCardActions: RepoActivityCardActions = {
  getFileTreeForLocalRepo: (repoPath) =>
    RepositoryMonitoringService.getFileTree(repoPath),
  getGithubTree: stubGetGithubTree,
  getAlexandriaRepositories: () => AlexandriaService.getRepositories(),
  getChangedFilesForLocalCommit: (repoPath, commitHash) =>
    GitService.getChangedFilesForCommit(repoPath, commitHash),
  getChangedFilesForGithubCommit: (owner, repo, sha) =>
    GithubService.getChangedFilesForCommit(owner, repo, sha),
  explainCommits: stubExplainCommits,
};
