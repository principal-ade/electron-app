import * as React from 'react';
import { useRepositoryGitStatus } from '../../../hooks/useRepositoryGitStatus';
import type {
  WorkingTreeChanges,
  WorkingTreeFile,
  WorkingTreeFileStatus,
} from './WorkingTreeCard';

/**
 * Adapter over `useRepositoryGitStatus` that flattens the
 * staged/modified/untracked/created/deleted buckets into a single
 * `{ path, status, staged }` list so the WorkingTreeCard can mirror
 * RecentCommitCard's idiom.
 *
 * Returns `null` (instead of an empty `WorkingTreeChanges`) when the repo is
 * clean, so the card can be conditionally rendered without a placeholder.
 */
export function useWorkingTreeChanges(
  repositoryPath: string | null,
): WorkingTreeChanges | null {
  const { gitStatusWithFiles } = useRepositoryGitStatus(repositoryPath);

  return React.useMemo<WorkingTreeChanges | null>(() => {
    if (!gitStatusWithFiles) return null;
    if (!gitStatusWithFiles.isDirty) return null;

    const byPath = new Map<string, WorkingTreeFile>();

    // Deletes win over other statuses for the same path so a staged delete
    // followed by a re-add (rare) still reads as deleted in the card.
    const merge = (
      path: string,
      status: WorkingTreeFileStatus,
      staged: boolean,
    ) => {
      const existing = byPath.get(path);
      if (!existing) {
        byPath.set(path, { path, status, staged });
        return;
      }
      const nextStatus: WorkingTreeFileStatus =
        existing.status === 'D' || status === 'D' ? 'D' : status;
      byPath.set(path, {
        path,
        status: nextStatus,
        staged: existing.staged || staged,
      });
    };

    // Staged buckets — repository-monitoring doesn't tell us whether a staged
    // change is an add/modify/delete, so we assume modify and let
    // createdFiles/deletedFiles upgrade where applicable below.
    for (const p of gitStatusWithFiles.stagedFiles) merge(p, 'M', true);
    for (const p of gitStatusWithFiles.modifiedFiles) merge(p, 'M', false);
    for (const p of gitStatusWithFiles.createdFiles) merge(p, 'A', false);
    // `createdFiles` is a documented subset of `untrackedFiles` — skip dupes.
    const createdSet = new Set(gitStatusWithFiles.createdFiles);
    for (const p of gitStatusWithFiles.untrackedFiles) {
      if (!createdSet.has(p)) merge(p, 'A', false);
    }
    for (const p of gitStatusWithFiles.deletedFiles) merge(p, 'D', false);

    const files = Array.from(byPath.values()).sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    return {
      branch: gitStatusWithFiles.branch,
      ahead: gitStatusWithFiles.ahead,
      behind: gitStatusWithFiles.behind,
      filesChanged: files.length,
      files,
    };
  }, [gitStatusWithFiles]);
}
