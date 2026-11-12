import { GitClientFactory } from '../utils/gitClientFactory';
import type { RunGit } from './repositorySync';

export type RepositoryDiffScope = 'staged' | 'unstaged' | 'upstream';

export interface RepositoryDiffFileStat {
  path: string;
  additions: number;
  deletions: number;
}

export interface RepositoryDiffScopeResult {
  scope: RepositoryDiffScope;
  files: RepositoryDiffFileStat[];
  totalAdditions: number;
  totalDeletions: number;
  patch: string;
  truncated: boolean;
  patchBytes: number;
}

export interface RepositoryDiffResult {
  path: string;
  branch?: string;
  upstream?: string;
  head?: string;
  upstreamHead?: string;
  ahead?: number;
  behind?: number;
  clean: boolean;
  porcelain: string[];
  untracked: string[];
  staged: string[];
  unstaged: string[];
  diffs: RepositoryDiffScopeResult[];
  error?: string;
}

export interface RepositoryDiffOptions {
  includeStaged: boolean;
  includeUnstaged: boolean;
  includeUpstream: boolean;
  contextLines: number;
  maxBytes: number;
}

export const DEFAULT_DIFF_OPTIONS: RepositoryDiffOptions = {
  includeStaged: true,
  includeUnstaged: true,
  includeUpstream: false,
  contextLines: 3,
  maxBytes: 100_000,
};

const MAX_CONTEXT_LINES = 10;
const MIN_MAX_BYTES = 1_024;
const MAX_MAX_BYTES = 500_000;

export function normalizeDiffOptions(
  input: Partial<RepositoryDiffOptions> = {},
): RepositoryDiffOptions {
  const contextLines =
    typeof input.contextLines === 'number' &&
    Number.isInteger(input.contextLines)
      ? Math.min(Math.max(input.contextLines, 0), MAX_CONTEXT_LINES)
      : DEFAULT_DIFF_OPTIONS.contextLines;
  const maxBytes =
    typeof input.maxBytes === 'number' && Number.isFinite(input.maxBytes)
      ? Math.min(
          Math.max(Math.floor(input.maxBytes), MIN_MAX_BYTES),
          MAX_MAX_BYTES,
        )
      : DEFAULT_DIFF_OPTIONS.maxBytes;
  return {
    includeStaged: input.includeStaged ?? DEFAULT_DIFF_OPTIONS.includeStaged,
    includeUnstaged:
      input.includeUnstaged ?? DEFAULT_DIFF_OPTIONS.includeUnstaged,
    includeUpstream:
      input.includeUpstream ?? DEFAULT_DIFF_OPTIONS.includeUpstream,
    contextLines,
    maxBytes,
  };
}

const defaultRunGit: RunGit = async (repoPath, args) => {
  const client = await GitClientFactory.getClient(repoPath);
  return client.raw(args);
};

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

function parsePorcelain(porcelain: string): {
  lines: string[];
  staged: string[];
  unstaged: string[];
  untracked: string[];
} {
  const lines = porcelain.length > 0 ? porcelain.split('\n') : [];
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  for (const line of lines) {
    if (line.startsWith('??')) {
      untracked.push(line.slice(3).trim());
      continue;
    }
    if (line.length < 4) continue;
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    const file = line.slice(3).trim();
    if (indexStatus !== ' ' && indexStatus !== '?') staged.push(file);
    if (worktreeStatus !== ' ' && worktreeStatus !== '?') unstaged.push(file);
  }
  return { lines, staged, unstaged, untracked };
}

function parseNumstat(output: string): RepositoryDiffFileStat[] {
  const files: RepositoryDiffFileStat[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 3) continue;
    const additions = Number(parts[0]);
    const deletions = Number(parts[1]);
    if (!Number.isFinite(additions) || !Number.isFinite(deletions)) continue;
    files.push({ path: parts.slice(2).join('\t'), additions, deletions });
  }
  return files;
}

function truncatePatch(
  patch: string,
  maxBytes: number,
): {
  patch: string;
  truncated: boolean;
  patchBytes: number;
} {
  const patchBytes = Buffer.byteLength(patch, 'utf8');
  if (patchBytes <= maxBytes) return { patch, truncated: false, patchBytes };
  let truncated = patch.slice(0, maxBytes);
  const lastNewline = truncated.lastIndexOf('\n');
  if (lastNewline > maxBytes * 0.8) truncated = truncated.slice(0, lastNewline);
  return {
    patch: `${truncated}\n... [truncated ${patchBytes - Buffer.byteLength(truncated, 'utf8')} bytes omitted]`,
    truncated: true,
    patchBytes,
  };
}

async function buildScopeDiff(
  runGit: RunGit,
  repoPath: string,
  scope: RepositoryDiffScope,
  options: RepositoryDiffOptions,
): Promise<RepositoryDiffScopeResult> {
  const contextArg = `-U${options.contextLines}`;
  const baseArgs = ['diff', '--no-color', '--no-ext-diff', contextArg];
  const args =
    scope === 'staged'
      ? [...baseArgs, '--cached', '--']
      : scope === 'upstream'
        ? [...baseArgs, 'HEAD...@{upstream}', '--']
        : [...baseArgs, '--'];
  const statArgs =
    scope === 'staged'
      ? ['diff', '--numstat', '--cached', '--']
      : scope === 'upstream'
        ? ['diff', '--numstat', 'HEAD...@{upstream}', '--']
        : ['diff', '--numstat', '--'];

  const [patchRaw, statRaw] = await Promise.all([
    tryGit(runGit, repoPath, args),
    tryGit(runGit, repoPath, statArgs),
  ]);
  const files = statRaw ? parseNumstat(statRaw) : [];
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const { patch, truncated, patchBytes } = truncatePatch(
    patchRaw ?? '',
    options.maxBytes,
  );
  return {
    scope,
    files,
    totalAdditions,
    totalDeletions,
    patch,
    truncated,
    patchBytes,
  };
}

/**
 * Read-only inspection of working-tree and upstream diffs for one registered
 * checkout. Never fetches, checks out, or mutates the repository.
 */
export async function inspectRepositoryDiff(
  repoPath: string,
  options: RepositoryDiffOptions = DEFAULT_DIFF_OPTIONS,
  runGit: RunGit = defaultRunGit,
): Promise<RepositoryDiffResult> {
  const result: RepositoryDiffResult = {
    path: repoPath,
    clean: true,
    porcelain: [],
    untracked: [],
    staged: [],
    unstaged: [],
    diffs: [],
  };

  const branch = await tryGit(runGit, repoPath, ['branch', '--show-current']);
  if (branch) result.branch = branch;

  const head = await tryGit(runGit, repoPath, ['rev-parse', 'HEAD']);
  if (head) result.head = head;

  const upstream = await tryGit(runGit, repoPath, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ]);
  if (upstream) {
    result.upstream = upstream;
    const counts = await tryGit(runGit, repoPath, [
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{upstream}',
    ]);
    if (counts) {
      const [aheadText, behindText] = counts.split(/\s+/);
      const ahead = Number(aheadText);
      const behind = Number(behindText);
      if (Number.isInteger(ahead) && Number.isInteger(behind)) {
        result.ahead = ahead;
        result.behind = behind;
      }
    }
    const upstreamHead = await tryGit(runGit, repoPath, [
      'rev-parse',
      '@{upstream}',
    ]);
    if (upstreamHead) result.upstreamHead = upstreamHead;
  }

  const porcelainRaw = await tryGit(runGit, repoPath, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (porcelainRaw === null) {
    result.error = 'could not read working-tree status';
    return result;
  }
  const parsed = parsePorcelain(porcelainRaw);
  result.porcelain = parsed.lines;
  result.staged = parsed.staged;
  result.unstaged = parsed.unstaged;
  result.untracked = parsed.untracked;
  result.clean = parsed.lines.length === 0;

  const scopes: RepositoryDiffScope[] = [];
  if (options.includeUnstaged) scopes.push('unstaged');
  if (options.includeStaged) scopes.push('staged');
  if (options.includeUpstream && result.upstream) scopes.push('upstream');

  for (const scope of scopes) {
    try {
      result.diffs.push(await buildScopeDiff(runGit, repoPath, scope, options));
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }
  if (options.includeUpstream && !result.upstream) {
    result.error = 'no upstream configured; upstream diff unavailable';
  }
  return result;
}
