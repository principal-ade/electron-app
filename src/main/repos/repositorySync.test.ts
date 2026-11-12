/** @jest-environment node */
import { syncRepository, type RunGit } from './repositorySync';

function gitFixture(options: {
  status?: string;
  branch?: string;
  counts?: string;
  upstream?: string | null;
  fetchError?: Error;
}) {
  let head = 'local-head';
  const calls: string[][] = [];
  const runGit: RunGit = async (_repoPath, args) => {
    calls.push(args);
    const command = args.join(' ');
    if (command === 'remote') return 'origin\nbackup\n';
    if (command.startsWith('remote get-url --all')) {
      return command.endsWith('origin')
        ? 'git@github.com:acme/repo.git\n'
        : 'https://example.com/acme/repo.git\n';
    }
    if (command.startsWith('remote get-url --push --all')) {
      return command.endsWith('origin')
        ? 'git@github.com:acme/repo.git\n'
        : 'https://example.com/acme/repo.git\n';
    }
    if (command === 'branch --show-current') return options.branch ?? 'main';
    if (command === 'rev-parse HEAD') return head;
    if (command === 'status --porcelain=v1 --untracked-files=all') {
      return options.status ?? '';
    }
    if (command === 'fetch --all --prune') {
      if (options.fetchError) throw options.fetchError;
      return '';
    }
    if (command === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') {
      if (options.upstream === null) throw new Error('no upstream');
      return options.upstream ?? 'origin/main';
    }
    if (command === 'rev-list --left-right --count HEAD...@{upstream}') {
      return options.counts ?? '0\t2';
    }
    if (command === 'rev-parse @{upstream}') return 'remote-head';
    if (command === 'merge --ff-only @{upstream}') {
      head = 'remote-head';
      return '';
    }
    throw new Error(`Unexpected git command: ${command}`);
  };
  return { runGit, calls };
}

test('inspects every remote and reports a clean branch as fast-forwardable without merging', async () => {
  const { runGit, calls } = gitFixture({});
  const result = await syncRepository(
    '/registered/repo',
    { apply: false },
    runGit,
  );

  expect(result).toMatchObject({
    status: 'fast-forwardable',
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 2,
    remotes: [
      {
        name: 'origin',
        fetchUrls: ['git@github.com:acme/repo.git'],
        pushUrls: ['git@github.com:acme/repo.git'],
      },
      {
        name: 'backup',
        fetchUrls: ['https://example.com/acme/repo.git'],
        pushUrls: ['https://example.com/acme/repo.git'],
      },
    ],
  });
  expect(calls).toContainEqual(['fetch', '--all', '--prune']);
  expect(calls.some((args) => args[0] === 'merge')).toBe(false);
});

test('fast-forwards only after a fresh clean-tree and unchanged-HEAD check', async () => {
  const { runGit, calls } = gitFixture({});
  const result = await syncRepository(
    '/registered/repo',
    { apply: true },
    runGit,
  );

  expect(result).toMatchObject({
    status: 'fast-forwarded',
    head: 'remote-head',
  });
  expect(calls).toContainEqual(['merge', '--ff-only', '@{upstream}']);
  expect(calls.filter((args) => args[0] === 'status')).toHaveLength(2);
});

test.each([
  { title: 'dirty tree', options: { status: '?? new-file' }, status: 'dirty' },
  { title: 'local commits', options: { counts: '2 0' }, status: 'local-ahead' },
  { title: 'diverged history', options: { counts: '1 2' }, status: 'diverged' },
  { title: 'detached HEAD', options: { branch: '' }, status: 'detached' },
  { title: 'no upstream', options: { upstream: null }, status: 'no-upstream' },
])('$title prevents a fast-forward', async ({ options, status }) => {
  const { runGit, calls } = gitFixture(options);
  const result = await syncRepository(
    '/registered/repo',
    { apply: true },
    runGit,
  );

  expect(result.status).toBe(status);
  expect(calls.some((args) => args[0] === 'merge')).toBe(false);
});

test('fetch failure is reported and prevents any branch update', async () => {
  const { runGit, calls } = gitFixture({ fetchError: new Error('offline') });
  const result = await syncRepository(
    '/registered/repo',
    { apply: true },
    runGit,
  );

  expect(result).toMatchObject({ status: 'fetch-failed', error: 'offline' });
  expect(calls.some((args) => args[0] === 'merge')).toBe(false);
});
