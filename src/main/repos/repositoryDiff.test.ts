/** @jest-environment node */
import { inspectRepositoryDiff, normalizeDiffOptions } from './repositoryDiff';
import type { RunGit } from './repositorySync';

function gitFixture() {
  const calls: string[][] = [];
  const runGit: RunGit = async (_repoPath, args) => {
    calls.push(args);
    const command = args.join(' ');
    if (command === 'branch --show-current') return 'main';
    if (command === 'rev-parse HEAD') return 'local-head';
    if (command === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}')
      return 'origin/main';
    if (command === 'rev-list --left-right --count HEAD...@{upstream}')
      return '0\t1';
    if (command === 'rev-parse @{upstream}') return 'remote-head';
    if (command === 'status --porcelain=v1 --untracked-files=all')
      return 'M  staged.ts\n M unstaged.ts\n?? new-file';
    if (command.startsWith('diff --numstat')) return '1\t2\tstaged.ts';
    if (command.includes('--cached'))
      return 'diff --git a/staged.ts b/staged.ts\n+staged';
    if (command.includes('HEAD...@{upstream}'))
      return 'diff --git a/upstream.ts b/upstream.ts\n+upstream';
    if (command.startsWith('diff '))
      return 'diff --git a/unstaged.ts\n+unstaged';
    throw new Error(`Unexpected git command: ${command}`);
  };
  return { runGit, calls };
}

test('reports porcelain state with staged and unstaged diffs', async () => {
  const { runGit, calls } = gitFixture();
  const result = await inspectRepositoryDiff(
    '/registered/repo',
    normalizeDiffOptions({}),
    runGit,
  );

  expect(result).toMatchObject({
    branch: 'main',
    upstream: 'origin/main',
    clean: false,
    staged: ['staged.ts'],
    unstaged: ['unstaged.ts'],
    untracked: ['new-file'],
  });
  expect(result.diffs.map((d) => d.scope)).toEqual(['unstaged', 'staged']);
  expect(calls.some((args) => args[0] === 'fetch')).toBe(false);
  expect(calls.some((args) => args[0] === 'merge')).toBe(false);
});

test('includes upstream diff only when requested and configured', async () => {
  const { runGit } = gitFixture();
  const result = await inspectRepositoryDiff(
    '/registered/repo',
    normalizeDiffOptions({ includeUpstream: true }),
    runGit,
  );
  expect(result.diffs.map((d) => d.scope)).toEqual([
    'unstaged',
    'staged',
    'upstream',
  ]);
});

test('normalizes diff options within safe bounds', () => {
  expect(
    normalizeDiffOptions({ contextLines: 99, maxBytes: 10_000_000 }),
  ).toMatchObject({ contextLines: 10, maxBytes: 500_000 });
});
