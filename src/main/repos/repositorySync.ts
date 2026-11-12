import { GitClientFactory } from '../utils/gitClientFactory';

export type RepositorySyncStatus =
  | 'fast-forwarded'
  | 'fast-forwardable'
  | 'up-to-date'
  | 'dirty'
  | 'local-ahead'
  | 'diverged'
  | 'detached'
  | 'no-upstream'
  | 'no-remotes'
  | 'busy'
  | 'fetch-failed'
  | 'fast-forward-failed';

export interface RepositorySyncResult {
  path: string;
  status: RepositorySyncStatus;
  branch?: string;
  upstream?: string;
  remotes: Array<{ name: string; fetchUrls: string[]; pushUrls: string[] }>;
  ahead?: number;
  behind?: number;
  head?: string;
  upstreamHead?: string;
  error?: string;
}

export interface RepositorySyncOptions {
  apply: boolean;
}

export type RunGit = (repoPath: string, args: string[]) => Promise<string>;

const defaultRunGit: RunGit = async (repoPath, args) => {
  const client = await GitClientFactory.getClient(repoPath);
  return client.raw(args);
};

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function tryGit(
  runGit: RunGit,
  repoPath: string,
  args: string[],
): Promise<string | null> {
  try {
    return (await runGit(repoPath, args)).trim();
  } catch {
    return null;
  }
}

async function listRemotes(
  runGit: RunGit,
  repoPath: string,
): Promise<Array<{ name: string; fetchUrls: string[]; pushUrls: string[] }>> {
  const names = (await runGit(repoPath, ['remote']))
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);

  const remotes: Array<{
    name: string;
    fetchUrls: string[];
    pushUrls: string[];
  }> = [];
  for (const name of names) {
    const fetchOutput = await runGit(repoPath, [
      'remote',
      'get-url',
      '--all',
      name,
    ]);
    const pushOutput = await runGit(repoPath, [
      'remote',
      'get-url',
      '--push',
      '--all',
      name,
    ]);
    remotes.push({
      name,
      fetchUrls: fetchOutput
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
      pushUrls: pushOutput
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    });
  }
  return remotes;
}

/**
 * Fetch every configured remote, then inspect (and optionally fast-forward)
 * only the checked-out branch. This deliberately never checks out branches,
 * rebases, resets, or merges non-fast-forward changes.
 */
export async function syncRepository(
  repoPath: string,
  options: RepositorySyncOptions,
  runGit: RunGit = defaultRunGit,
): Promise<RepositorySyncResult> {
  const result: RepositorySyncResult = {
    path: repoPath,
    status: 'no-upstream',
    remotes: [],
  };

  try {
    result.remotes = await listRemotes(runGit, repoPath);
  } catch (error) {
    result.status = 'fetch-failed';
    result.error = `could not list remotes: ${asErrorMessage(error)}`;
    return result;
  }

  const branch = await tryGit(runGit, repoPath, ['branch', '--show-current']);
  if (!branch) {
    result.status = 'detached';
    return result;
  }
  result.branch = branch;

  const head = await tryGit(runGit, repoPath, ['rev-parse', 'HEAD']);
  if (head) result.head = head;

  const initialStatus = await tryGit(runGit, repoPath, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (initialStatus === null) {
    result.status = 'fetch-failed';
    result.error = 'could not read working-tree status';
    return result;
  }
  const wasDirty = initialStatus.length > 0;

  if (result.remotes.length === 0) {
    result.status = 'no-remotes';
    return result;
  }

  try {
    await runGit(repoPath, ['fetch', '--all', '--prune']);
  } catch (error) {
    result.status = 'fetch-failed';
    result.error = asErrorMessage(error);
    return result;
  }

  const upstream = await tryGit(runGit, repoPath, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ]);
  if (!upstream) {
    result.status = 'no-upstream';
    return result;
  }
  result.upstream = upstream;

  const counts = await tryGit(runGit, repoPath, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}',
  ]);
  if (!counts) {
    result.status = 'no-upstream';
    return result;
  }
  const [aheadText, behindText] = counts.split(/\s+/);
  const ahead = Number(aheadText);
  const behind = Number(behindText);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    result.status = 'fetch-failed';
    result.error = `could not parse upstream commit counts: ${counts}`;
    return result;
  }
  result.ahead = ahead;
  result.behind = behind;
  const upstreamHead = await tryGit(runGit, repoPath, [
    'rev-parse',
    '@{upstream}',
  ]);
  if (upstreamHead) result.upstreamHead = upstreamHead;

  if (ahead > 0 && behind > 0) {
    result.status = 'diverged';
    return result;
  }
  if (ahead > 0) {
    result.status = 'local-ahead';
    return result;
  }
  if (behind === 0) {
    result.status = 'up-to-date';
    return result;
  }
  if (wasDirty) {
    result.status = 'dirty';
    return result;
  }
  if (!options.apply) {
    result.status = 'fast-forwardable';
    return result;
  }

  // Recheck both the worktree and HEAD immediately before mutation. This
  // avoids overwriting edits or advancing a branch another process changed
  // while the remote fetch was in progress.
  const currentStatus = await tryGit(runGit, repoPath, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  const currentHead = await tryGit(runGit, repoPath, ['rev-parse', 'HEAD']);
  if (currentStatus === null || currentStatus.length > 0) {
    result.status = 'dirty';
    return result;
  }
  if (!head || currentHead !== head) {
    result.status = 'fast-forward-failed';
    result.error = 'HEAD changed while checking the repository; retry sync';
    return result;
  }

  try {
    await runGit(repoPath, ['merge', '--ff-only', '@{upstream}']);
    result.status = 'fast-forwarded';
    result.head =
      (await tryGit(runGit, repoPath, ['rev-parse', 'HEAD'])) ?? undefined;
  } catch (error) {
    result.status = 'fast-forward-failed';
    result.error = asErrorMessage(error);
  }
  return result;
}
