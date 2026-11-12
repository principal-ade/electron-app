import { GitService } from '../../main-process-api/GitService';

export type SyncSingleStatus =
  | 'fast-forwarded'
  | 'up-to-date'
  | 'dirty'
  | 'local-ahead'
  | 'diverged'
  | 'detached'
  | 'no-upstream'
  | 'no-remotes'
  | 'fetch-failed'
  | 'fast-forward-failed';

export interface SyncSingleResult {
  path: string;
  status: SyncSingleStatus;
  branch?: string;
  ahead?: number;
  behind?: number;
  error?: string;
}

type ExecFn = (args: string[]) => Promise<string>;

async function tryExec(exec: ExecFn, args: string[]): Promise<string | null> {
  try {
    return ((await exec(args)) ?? '').trim();
  } catch {
    return null;
  }
}

/**
 * Safely fast-forward a single clone, mirroring the main-process
 * `syncRepository(..., { apply: true })` semantics:
 * only the checked-out branch, clean tree (including untracked files),
 * strictly behind with no local-only commits, then re-verify the tree and
 * HEAD immediately before `merge --ff-only @{upstream}`.
 *
 * Runs via the renderer's git IPC bridge so Sky View can drive it without a
 * new main-process channel.
 */
export async function syncSingleRepository(
  repoPath: string,
  exec?: ExecFn,
): Promise<SyncSingleResult> {
  const run: ExecFn =
    exec ??
    (async (args) => {
      const result = await GitService.execCommand(repoPath, args);
      return result.stdout;
    });

  const branch = await tryExec(run, ['branch', '--show-current']);
  if (!branch) {
    return { path: repoPath, status: 'detached' };
  }

  const head = await tryExec(run, ['rev-parse', 'HEAD']);

  const initialStatus = await tryExec(run, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (initialStatus === null) {
    return {
      path: repoPath,
      status: 'fetch-failed',
      branch,
      error: 'could not read working-tree status',
    };
  }
  const wasDirty = initialStatus.length > 0;

  const remotesRaw = await tryExec(run, ['remote']);
  if (remotesRaw === null) {
    return {
      path: repoPath,
      status: 'fetch-failed',
      branch,
      error: 'could not list remotes',
    };
  }
  if (remotesRaw.length === 0) {
    return { path: repoPath, status: 'no-remotes', branch };
  }

  try {
    await run(['fetch', '--all', '--prune']);
  } catch (error) {
    return {
      path: repoPath,
      status: 'fetch-failed',
      branch,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const upstream = await tryExec(run, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ]);
  if (!upstream) {
    return { path: repoPath, status: 'no-upstream', branch };
  }

  const counts = await tryExec(run, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]);
  if (!counts) {
    return { path: repoPath, status: 'no-upstream', branch };
  }
  const [aheadText, behindText] = counts.split(/\s+/);
  const ahead = Number(aheadText);
  const behind = Number(behindText);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    return {
      path: repoPath,
      status: 'fetch-failed',
      branch,
      error: `could not parse upstream commit counts: ${counts}`,
    };
  }

  if (ahead > 0 && behind > 0) {
    return { path: repoPath, status: 'diverged', branch, ahead, behind };
  }
  if (ahead > 0) {
    return { path: repoPath, status: 'local-ahead', branch, ahead, behind };
  }
  if (behind === 0) {
    return { path: repoPath, status: 'up-to-date', branch, ahead, behind };
  }
  if (wasDirty) {
    return { path: repoPath, status: 'dirty', branch, ahead, behind };
  }

  // Pre-mutation recheck: avoid overwriting edits or advancing a branch
  // another process moved while the fetch was in flight.
  const currentStatus = await tryExec(run, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  const currentHead = await tryExec(run, ['rev-parse', 'HEAD']);
  if (currentStatus === null || currentStatus.length > 0) {
    return { path: repoPath, status: 'dirty', branch, ahead, behind };
  }
  if (!head || currentHead !== head) {
    return {
      path: repoPath,
      status: 'fast-forward-failed',
      branch,
      ahead,
      behind,
      error: 'HEAD changed while checking the repository; retry sync',
    };
  }

  try {
    await run(['merge', '--ff-only', '@{upstream}']);
    return { path: repoPath, status: 'fast-forwarded', branch, ahead, behind };
  } catch (error) {
    return {
      path: repoPath,
      status: 'fast-forward-failed',
      branch,
      ahead,
      behind,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
