/**
 * Debug timeline of repo-load + city-build phases for File City.
 *
 * Module-scope subscribable store: phase callers push checkpoints
 * (RepositoryPanelContext for the IPC phases, FileCityPanel for the build
 * phases). The toolbar Gauge button in FileCityExplorer reads the latest
 * snapshot to render LoadCheckpointsModal.
 *
 * Wall-clock is captured with `performance.now()` for sub-ms deltas and
 * `Date.now()` for an absolute timestamp the modal can display.
 */

export type CheckpointPhase =
  | 'repo.path.set'
  | 'ipc.cache_get.start'
  | 'ipc.cache_get.end'
  | 'ipc.refresh.start'
  | 'ipc.refresh.end'
  | 'cache_sync.fresh_received'
  | 'build_city.start'
  | 'build_city.end'
  | 'panel.first_render';

export interface Checkpoint {
  repoPath: string | null;
  phase: CheckpointPhase;
  /** `performance.now()` at the time of the push. */
  perfMs: number;
  /** `Date.now()` at the time of the push. */
  wallMs: number;
  /** Optional small bag of phase-specific facts (file count, sha, error). */
  detail?: Record<string, unknown>;
}

type Listener = () => void;

const checkpoints: Checkpoint[] = [];
const listeners = new Set<Listener>();

const notify = (): void => {
  for (const l of listeners) l();
};

export const pushCheckpoint = (
  repoPath: string | null,
  phase: CheckpointPhase,
  detail?: Record<string, unknown>,
): void => {
  checkpoints.push({
    repoPath,
    phase,
    perfMs: performance.now(),
    wallMs: Date.now(),
    detail,
  });
  notify();
};

export const subscribeCheckpoints = (cb: Listener): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const snapshotCheckpoints = (repoPath?: string | null): Checkpoint[] => {
  if (repoPath === undefined) return checkpoints.slice();
  return checkpoints.filter((c) => c.repoPath === repoPath);
};

export const clearCheckpointsForRepo = (repoPath: string | null): void => {
  // Drop in place so listeners observe a single notify.
  for (let i = checkpoints.length - 1; i >= 0; i--) {
    if (checkpoints[i].repoPath === repoPath) checkpoints.splice(i, 1);
  }
  notify();
};
