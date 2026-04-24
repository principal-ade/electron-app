/**
 * Real `InProgressRepoCardActions` wiring backed by the renderer's
 * main-process-api services. Kept out of InProgressRepoCard.tsx so the card
 * stays importable in non-Electron environments (Storybook, tests).
 */

import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { WebAdeService } from '../main-process-api/WebAdeService';
import type { WorkingChangeData } from '../../shared/tipc/webAdeRouterTypes';
import type {
  ExplainInProgressInput,
  ExplainInProgressResponse,
  InProgressChangedFile,
  InProgressFileStatus,
  InProgressRepoCardActions,
} from './InProgressRepoCard';

function pathsToFiles(
  paths: string[],
  status: InProgressFileStatus,
  staged: boolean,
): InProgressChangedFile[] {
  return paths.map((path) => ({
    path,
    status,
    additions: 0,
    deletions: 0,
    staged,
  }));
}

async function getWorkingChanges(repoPath: string): Promise<InProgressChangedFile[]> {
  const status = await RepositoryMonitoringService.getGitStatusWithFiles(repoPath);
  if (!status) return [];

  // Working tree modifications are in modifiedFiles; staged changes are in
  // stagedFiles. A file can appear in both (partially staged) — we surface
  // both rows so the card shows the full picture, distinguished by the
  // `staged` flag.
  const files: InProgressChangedFile[] = [];
  files.push(...pathsToFiles(status.stagedFiles, 'modified', true));
  files.push(...pathsToFiles(status.modifiedFiles, 'modified', false));
  files.push(...pathsToFiles(status.createdFiles, 'added', false));
  files.push(
    ...pathsToFiles(
      status.untrackedFiles.filter((p) => !status.createdFiles.includes(p)),
      'untracked',
      false,
    ),
  );
  files.push(...pathsToFiles(status.deletedFiles, 'deleted', false));
  return files;
}

async function explainWorkingChanges(
  input: ExplainInProgressInput,
): Promise<ExplainInProgressResponse> {
  const changes: WorkingChangeData[] = input.files.map((f) => ({
    path: f.path,
    status: f.status,
    additions: f.additions || undefined,
    deletions: f.deletions || undefined,
    staged: f.staged,
  }));

  return WebAdeService.explainWorkingChanges({
    changes,
    audienceLevel: input.audienceLevel,
    repoName: input.repoName,
    branch: input.branch,
  });
}

export const inProgressActivityPanelActions: InProgressRepoCardActions = {
  getFileTreeForLocalRepo: (repoPath) => RepositoryMonitoringService.getFileTree(repoPath),
  getWorkingChanges,
  explainWorkingChanges,
};
