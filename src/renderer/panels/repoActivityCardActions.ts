/**
 * Real `RepoActivityCardActions` wiring backed by the renderer's
 * main-process-api services. Kept out of RepoActivityCard.tsx so the card
 * stays importable in non-Electron environments (Storybook, tests).
 */

import { GitService } from '../main-process-api/GitService';
import { GithubService } from '../main-process-api/GithubService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import type { RepoActivityCardActions } from './RepoActivityCard';

export const repoActivityCardActions: RepoActivityCardActions = {
  getFileTreeForLocalRepo: (repoPath) =>
    RepositoryMonitoringService.getFileTree(repoPath),
  getGithubTree: (owner, repo) => WebAdeService.getGithubTree(owner, repo),
  getAlexandriaRepositories: () => AlexandriaService.getRepositories(),
  getChangedFilesForLocalCommit: (repoPath, commitHash) =>
    GitService.getChangedFilesForCommit(repoPath, commitHash),
  getChangedFilesForGithubCommit: (owner, repo, sha) =>
    GithubService.getChangedFilesForCommit(owner, repo, sha),
  explainCommits: (input) => WebAdeService.explainCommits(input),
};
