/** @jest-environment node */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('electron', () => ({
  BrowserWindow: { fromWebContents: jest.fn() },
}));

const windows = (): { fromWebContents: jest.Mock } =>
  jest.requireMock('electron').BrowserWindow;

jest.mock('../../builds/buildInstances', () => {
  const configs = new Map<string, Record<string, unknown>>();
  const runs = new Map<string, Record<string, unknown>>();
  return {
    getBuildConfigurationStore: () => ({
      listSummaries: async () =>
        [...configs.values()].map((config) => ({
          id: config.id,
          name: config.name,
          repo: config.repo,
          status: config.status,
          updatedAt: config.updatedAt,
        })),
      get: async (id: string) => configs.get(id) ?? null,
      __configs: configs,
    }),
    getBuildSecretResolver: () => ({
      resolve: async () => ({ env: { NODE_AUTH_TOKEN: 'v' }, missing: [] }),
    }),
    getBuildRunRegistry: () => ({
      trackRun: jest.fn((input: Record<string, unknown>) => {
        const record = { ...input, status: 'running', startedAt: 'now' };
        runs.set(input.runId as string, record);
        return record;
      }),
      getRun: jest.fn((runId: string) => runs.get(runId) ?? null),
      listRuns: jest.fn(() => Array.from(runs.values())),
      stopRun: jest.fn(async (runId: string) => {
        const record = runs.get(runId);
        if (record?.status === 'running') record.status = 'cancelled';
        return record ?? null;
      }),
    }),
    listRegisteredRepositoryPurls: async () => ['pkg:github/owner/repo'],
    getGrantedSecretKeys: async () => ['NODE_AUTH_TOKEN'],
    getBuildRoots: async () => ({}),
  };
});

jest.mock('../../terminal/terminalSessionService', () => ({
  createTerminalSession: jest.fn(async () => ({ sessionId: 'session-9' })),
}));

type Router = {
  buildConfiguration_run: {
    action: (args: {
      context: unknown;
      input: { id: string };
    }) => Promise<unknown>;
  };
  buildConfiguration_getRun: {
    action: (args: {
      context: unknown;
      input: { runId: string };
    }) => Promise<unknown>;
  };
  buildConfiguration_listRuns: {
    action: (args: { context: unknown; input?: void }) => Promise<unknown>;
  };
  buildConfiguration_stopRun: {
    action: (args: {
      context: unknown;
      input: { runId: string };
    }) => Promise<unknown>;
  };
};

function loadRouter(): Router {
  jest.resetModules();
  return require('./buildConfigurationRouter').buildConfigurationRouter;
}

describe('buildConfigurationRouter runs', () => {
  let directory: string;
  let router: Router;
  let configs: Map<string, Record<string, unknown>>;

  const storedBase = (checkoutPath: string) => ({
    id: 'bc-web-build',
    name: 'web build',
    repo: 'pkg:github/owner/repo',
    checkout: { path: checkoutPath, ref: 'main', depth: 1, reset: 'ff-only' },
    command: { line: 'npm run build', cwd: '.', timeoutMs: 60_000 },
    secrets: [{ env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true }],
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
  });

  const fingerprint =
    '["pkg:github/owner/repo","main","npm run build",["NODE_AUTH_TOKEN"]]';

  const confirmed = (checkoutPath: string) => ({
    ...storedBase(checkoutPath),
    secretConfirmation: { fingerprint, envNames: ['NODE_AUTH_TOKEN'] },
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'build-config-tipc-'));
    router = loadRouter();
    const instances = jest.requireMock('../../builds/buildInstances');
    configs = instances.getBuildConfigurationStore().__configs;
    configs.set('bc-web-build', confirmed(directory));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('runs a confirmed config and reads the run back', async () => {
    windows().fromWebContents.mockReturnValue({
      id: 3,
      isDestroyed: () => false,
    });
    const result = await router.buildConfiguration_run.action({
      context: { sender: {} },
      input: { id: 'bc-web-build' },
    });
    expect(result).toMatchObject({
      ok: true,
      configId: 'bc-web-build',
      terminalSessionId: 'session-9',
      status: 'running',
    });
    const record = await router.buildConfiguration_getRun.action({
      context: {},
      input: { runId: (result as { runId: string }).runId },
    });
    expect(record).toMatchObject({ status: 'running' });
    await expect(
      router.buildConfiguration_listRuns.action({ context: {} }),
    ).resolves.toEqual([record]);

    const stopped = await router.buildConfiguration_stopRun.action({
      context: {},
      input: { runId: (result as { runId: string }).runId },
    });
    expect(stopped).toMatchObject({ status: 'cancelled' });
  });

  test('refuses without a live window', async () => {
    windows().fromWebContents.mockReturnValue(null);
    const result = await router.buildConfiguration_run.action({
      context: { sender: {} },
      input: { id: 'bc-web-build' },
    });
    expect(result).toMatchObject({ ok: false, code: 'no-window' });
  });

  test('refuses unconfirmed configs', async () => {
    windows().fromWebContents.mockReturnValue({
      id: 3,
      isDestroyed: () => false,
    });
    configs.set('bc-web-build', storedBase(directory));
    const result = await router.buildConfiguration_run.action({
      context: { sender: {} },
      input: { id: 'bc-web-build' },
    });
    expect(result).toMatchObject({ ok: false, code: 'not-confirmed' });
  });
});
