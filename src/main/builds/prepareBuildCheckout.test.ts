import type { BuildConfiguration } from '../../shared/build-configurations/types';
import { prepareBuildCheckout, type GitRunner } from './prepareBuildCheckout';

const config = (
  overrides: Partial<BuildConfiguration> = {},
): BuildConfiguration =>
  ({
    id: 'bc-test',
    name: 'test build',
    repo: 'pkg:github/acme/app',
    checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
    command: { line: 'npm run build', cwd: '.', timeoutMs: 1000 },
    secrets: [],
    secretConfirmation: null,
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  }) as BuildConfiguration;

function harness(options: { gitCheckouts?: string[]; gitError?: Error }) {
  const calls: Array<{ args: string[]; cwd?: string }> = [];
  const git: GitRunner = async (args, cwd) => {
    calls.push({ args, cwd });
    if (options.gitError) throw options.gitError;
    return { stdout: '', stderr: '' };
  };
  return { calls, git, checkouts: new Set(options.gitCheckouts ?? []) };
}

const directory = '/builds/acme/app';

test('clones a missing checkout from the config repo and ref', async () => {
  const h = harness({});
  const result = await prepareBuildCheckout(
    {
      config: config({
        checkout: { path: null, ref: 'v2.4.0', depth: 1, reset: 'ff-only' },
      }),
      directory,
    },
    {
      git: h.git,
      exists: (path) => h.checkouts.has(path),
      makeDirectory: async () => {},
    },
  );

  expect(result).toEqual({ ok: true, action: 'cloned' });
  expect(h.calls[0].args).toEqual([
    'clone',
    '--depth',
    '1',
    '--branch',
    'v2.4.0',
    '--single-branch',
    'https://github.com/acme/app.git',
    directory,
  ]);
});

test('fetches an existing checkout and fast-forwards by policy', async () => {
  const h = harness({ gitCheckouts: [`${directory}/.git`] });
  const result = await prepareBuildCheckout(
    { config: config(), directory },
    {
      git: h.git,
      exists: (path) => h.checkouts.has(path),
      makeDirectory: async () => {},
    },
  );

  expect(result).toEqual({ ok: true, action: 'updated' });
  expect(h.calls.map((call) => call.args)).toEqual([
    ['fetch', '--depth', '1', 'origin', 'main'],
    ['merge', '--ff-only', 'FETCH_HEAD'],
  ]);
  expect(h.calls[0].cwd).toBe(directory);
});

test('resets a dirty checkout by policy without deleting ignored files', async () => {
  const h = harness({ gitCheckouts: [`${directory}/.git`] });
  const result = await prepareBuildCheckout(
    {
      config: config({
        checkout: { path: null, ref: 'main', depth: 1, reset: 'clean' },
      }),
      directory,
    },
    {
      git: h.git,
      exists: (path) => h.checkouts.has(path),
      makeDirectory: async () => {},
    },
  );

  expect(result).toEqual({ ok: true, action: 'updated' });
  expect(h.calls.map((call) => call.args)).toEqual([
    ['fetch', '--depth', '1', 'origin', 'main'],
    ['reset', '--hard', 'FETCH_HEAD'],
    ['clean', '-fd'],
  ]);
});

test('leaves the checkout alone when reset is none', async () => {
  const h = harness({ gitCheckouts: [`${directory}/.git`] });
  const result = await prepareBuildCheckout(
    {
      config: config({
        checkout: { path: null, ref: 'main', depth: 1, reset: 'none' },
      }),
      directory,
    },
    {
      git: h.git,
      exists: (path) => h.checkouts.has(path),
      makeDirectory: async () => {},
    },
  );

  expect(result).toEqual({ ok: true, action: 'reused' });
  expect(h.calls).toEqual([]);
});

test('refuses a directory that is not a git checkout', async () => {
  const h = harness({});
  const result = await prepareBuildCheckout(
    { config: config(), directory },
    {
      git: h.git,
      exists: (path) => path === directory,
      makeDirectory: async () => {},
    },
  );

  expect(result.ok).toBe(false);
  expect(h.calls).toEqual([]);
});

test('falls back to fetch-by-sha when the ref is a commit', async () => {
  const sha = '1234567890abcdef1234567890abcdef12345678';
  const calls: string[][] = [];
  const git: GitRunner = async (args) => {
    calls.push(args);
    if (args[0] === 'clone') throw new Error('Remote branch not found');
    return { stdout: '', stderr: '' };
  };
  const result = await prepareBuildCheckout(
    {
      config: config({
        checkout: { path: null, ref: sha, depth: 1, reset: 'ff-only' },
      }),
      directory,
    },
    { git, exists: () => false, makeDirectory: async () => {} },
  );

  expect(result).toEqual({ ok: true, action: 'cloned' });
  expect(calls.slice(1).map((args) => args[0])).toEqual([
    'init',
    'remote',
    'fetch',
    'checkout',
  ]);
});

test('reports clone failures instead of throwing', async () => {
  const h = harness({ gitError: new Error('repository not found') });
  const result = await prepareBuildCheckout(
    { config: config(), directory },
    {
      git: h.git,
      exists: () => false,
      makeDirectory: async () => {},
    },
  );

  expect(result).toEqual({
    ok: false,
    error: expect.stringContaining('repository not found'),
  });
});
