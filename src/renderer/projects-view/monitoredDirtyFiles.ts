import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import type { CommitFileChange } from '@industry-theme/file-city-panel';

/** Monitor snapshots carry paths, not porcelain rename/copy details. */
export function monitoredDirtyFiles(
  status: GitStatusWithFiles,
): CommitFileChange[] {
  const files = new Map<string, CommitFileChange>();
  const add = (paths: string[], kind: CommitFileChange['status']) => {
    for (const path of paths) files.set(path, { path, status: kind });
  };
  add(status.stagedFiles, 'modified');
  add(status.modifiedFiles, 'modified');
  add(status.createdFiles, 'added');
  add(status.untrackedFiles, 'added');
  add(status.deletedFiles, 'removed');
  return [...files.values()];
}
