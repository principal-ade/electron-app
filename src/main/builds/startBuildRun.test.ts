import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  confirmationFingerprintSource,
  type BuildConfiguration,
} from '../../shared/build-configurations/types';
import { startBuildRun, type StartBuildRunDeps } from './startBuildRun';

const checkoutDir = () => join(buildsDirectory, 'acme', 'app');
let buildsDirectory: string;

beforeEach(async () => {
  buildsDirectory = await mkdtemp(join(tmpdir(), 'build-runs-'));
});

afterEach(async () => {
  await rm(buildsDirectory, { recursive: true, force: true });
});

function config(): BuildConfiguration {
  const base = {
    id: 'bc-test',
    name: 'test build',
    repo: 'pkg:github/acme/app',
    checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' },
    command: { line: 'npm run build', cwd: '.', timeoutMs: 60_000 },
    secrets: [],
    createdAt: 'now',
    updatedAt: 'now',
  } as unknown as BuildConfiguration;
  return {
    ...base,
    secretConfirmation: {
      fingerprint: confirmationFingerprintSource(base),
      envNames: [],
    },
  };
}

function deps(overrides: Partial<StartBuildRunDeps> = {}) {
  const runs = {
    resolveSecrets: jest.fn(async () => ({ env: {}, missing: [] })),
    trackRun: jest.fn((input: Record<string, unknown>) => ({
      ...input,
      status: 'running',
    })),
    getRun: jest.fn(() => null),
    createBuildSession: jest.fn(async () => ({ sessionId: 'session-1' })),
    getBuildRoots: jest.fn(async () => ({ buildsDirectory })),
    prepareCheckout: jest.fn(
      async (): Promise<
        { ok: true; action: string } | { ok: false; error: string }
      > => {
        await mkdir(checkoutDir(), { recursive: true });
        return { ok: true, action: 'cloned' };
      },
    ),
  };
  return {
    runs,
    deps: {
      store: { get: async () => config() },
      listRepositoryPurls: async () => ['pkg:github/acme/app'],
      getGrantedKeys: async () => [],
      runs,
      ...overrides,
    } as StartBuildRunDeps,
  };
}

test('clones a missing checkout before spawning the build session', async () => {
  const { deps: d, runs } = deps();

  const result = await startBuildRun(d, 'bc-test');

  expect(result).toMatchObject({ ok: true, terminalSessionId: 'session-1' });
  expect(runs.trackRun).toHaveBeenCalledWith(
    expect.objectContaining({ cleanupDelayMs: 5 * 60 * 1000 }),
  );
  expect(runs.prepareCheckout).toHaveBeenCalledWith({
    config: expect.objectContaining({ id: 'bc-test' }),
    directory: checkoutDir(),
  });
  expect(runs.createBuildSession).toHaveBeenCalledWith(
    expect.objectContaining({ cwd: checkoutDir() }),
  );
});

test('refuses to run when checkout preparation fails', async () => {
  const { deps: d, runs } = deps();
  runs.prepareCheckout.mockResolvedValueOnce({
    ok: false as const,
    error: 'repository not found',
  });

  const result = await startBuildRun(d, 'bc-test');

  expect(result).toMatchObject({
    ok: false,
    code: 'checkout-failed',
    error: 'repository not found',
  });
  expect(runs.createBuildSession).not.toHaveBeenCalled();
});
