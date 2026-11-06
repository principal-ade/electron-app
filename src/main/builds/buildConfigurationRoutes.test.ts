/** @jest-environment node */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Application, Request, Response } from 'express';
import { BuildConfigurationStore } from '../build-configurations/BuildConfigurationStore';
import { confirmationFingerprintSource } from '../../shared/build-configurations/types';
import {
  registerBuildConfigurationRoutes,
  type SecretRequestEvent,
} from './buildConfigurationRoutes';

type Handler = (req: Request, res: Response) => Promise<void>;

const FIELDS = () => ({
  name: 'web build',
  repo: 'pkg:github/owner/repo',
  checkout: { path: null, ref: 'main', depth: 1, reset: 'ff-only' as const },
  command: { line: 'npm run build', cwd: '.', timeoutMs: 900_000 },
  secrets: [{ env: 'NODE_AUTH_TOKEN', label: 'npm token', required: true }],
});

function handlers(store: BuildConfigurationStore, overrides = {}) {
  const get = jest.fn();
  const post = jest.fn();
  const patch = jest.fn();
  const del = jest.fn();
  registerBuildConfigurationRoutes(
    { get, post, patch, delete: del } as unknown as Application,
    {
      store,
      listRepositoryPurls: async () => ['pkg:github/owner/repo'],
      getGrantedKeys: async () => [],
      ...overrides,
    },
  );
  const byPath = (calls: jest.Mock, path: string) =>
    calls.mock.calls.find(([routePath]) => routePath === path)?.[1] as Handler;
  return {
    getConfigs: byPath(get, '/api/build-configurations'),
    postConfigs: byPath(post, '/api/build-configurations'),
    getConfig: byPath(get, '/api/build-configurations/:id'),
    patchConfig: byPath(patch, '/api/build-configurations/:id'),
    deleteConfig: byPath(del, '/api/build-configurations/:id'),
    preflight: byPath(get, '/api/build-configurations/:id/preflight'),
    requestSecrets: byPath(
      post,
      '/api/build-configurations/:id/request-secrets',
    ),
    run: byPath(post, '/api/build-configurations/:id/run'),
    getRun: byPath(get, '/api/build-runs/:id'),
    getRunOutput: byPath(get, '/api/build-runs/:id/output'),
  };
}

function response() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

function body(res: Response) {
  return (res.json as unknown as jest.Mock).mock.calls[0][0];
}

function status(res: Response) {
  return (res.status as unknown as jest.Mock).mock.calls[0]?.[0] as
    | number
    | undefined;
}

describe('buildConfigurationRoutes', () => {
  let directory: string;
  let store: BuildConfigurationStore;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'build-config-routes-'));
    store = new BuildConfigurationStore(directory);
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('creates unconfirmed configs and lists them', async () => {
    const h = handlers(store);
    const created = response();
    await h.postConfigs({ body: FIELDS() } as unknown as Request, created);
    expect(status(created)).toBe(201);
    expect(body(created).config.secretConfirmation).toBeNull();

    const listed = response();
    await h.getConfigs({} as Request, listed);
    expect(body(listed).configs).toHaveLength(1);
  });

  test('the bridge can never confirm: POST and PATCH reject confirmations', async () => {
    const h = handlers(store);
    const postRes = response();
    await h.postConfigs(
      {
        body: {
          ...FIELDS(),
          secretConfirmation: { fingerprint: 'x', envNames: [] },
        },
      } as unknown as Request,
      postRes,
    );
    expect(status(postRes)).toBe(400);
    expect(body(postRes).error).toMatch(/confirm/);

    const created = await store.create(FIELDS());
    const patchRes = response();
    await h.patchConfig(
      {
        params: { id: created.id },
        body: { secretConfirmation: { fingerprint: 'x', envNames: [] } },
      } as unknown as Request,
      patchRes,
    );
    expect(status(patchRes)).toBe(400);
  });

  test('rejects invalid configs with the validation issues', async () => {
    const h = handlers(store);
    const res = response();
    await h.postConfigs(
      {
        body: {
          ...FIELDS(),
          command: { line: 'rm -rf /', cwd: '.', timeoutMs: 1 },
        },
      } as unknown as Request,
      res,
    );
    expect(status(res)).toBe(400);
    expect(body(res).issues.join(' ')).toMatch(/allowlist/);
  });

  test('reads, patches, and deletes; unknown ids are 404', async () => {
    const h = handlers(store);
    const created = await store.create(FIELDS());
    const read = response();
    await h.getConfig(
      { params: { id: created.id } } as unknown as Request,
      read,
    );
    expect(body(read).config.id).toBe(created.id);

    const missing = response();
    await h.getConfig(
      { params: { id: 'bc-missing' } } as unknown as Request,
      missing,
    );
    expect(status(missing)).toBe(404);

    const patched = response();
    await h.patchConfig(
      {
        params: { id: created.id },
        body: { name: 'renamed' },
      } as unknown as Request,
      patched,
    );
    expect(body(patched).config.name).toBe('renamed');

    const deleted = response();
    await h.deleteConfig(
      { params: { id: created.id } } as unknown as Request,
      deleted,
    );
    expect(body(deleted)).toEqual({ success: true, id: created.id });

    const gone = response();
    await h.deleteConfig(
      { params: { id: created.id } } as unknown as Request,
      gone,
    );
    expect(status(gone)).toBe(404);
  });

  test('preflight reports readiness across confirmation, secrets, repo, and binary', async () => {
    const created = await store.create(FIELDS());
    const check = async (overrides = {}) => {
      const res = response();
      await handlers(store, overrides).preflight(
        { params: { id: created.id } } as unknown as Request,
        res,
      );
      return body(res);
    };
    // Unconfirmed, nothing granted, repo registered: not ready.
    expect(await check()).toMatchObject({
      ready: false,
      checks: {
        confirmed: false,
        missingSecrets: ['NODE_AUTH_TOKEN'],
        repoRegistered: true,
        binaryAllowed: true,
      },
    });
    // Confirmed but secret still missing.
    const current = await store.get(created.id);
    if (!current) throw new Error('missing fixture config');
    await store.update(created.id, {
      secretConfirmation: {
        fingerprint: confirmationFingerprintSource(current),
        envNames: ['NODE_AUTH_TOKEN'],
      },
    });
    expect((await check()).ready).toBe(false);
    // Grant the secret: ready.
    expect(
      (await check({ getGrantedKeys: async () => ['NODE_AUTH_TOKEN'] })).ready,
    ).toBe(true);
    // Unregistered repo: not ready.
    expect(
      (
        await check({
          getGrantedKeys: async () => ['NODE_AUTH_TOKEN'],
          listRepositoryPurls: async () => [],
        })
      ).ready,
    ).toBe(false);
  });

  test('request-secrets reports missing and notifies the sink', async () => {
    const created = await store.create(FIELDS());
    const events: SecretRequestEvent[] = [];
    const h = handlers(store, {
      getGrantedKeys: async () => [],
      onSecretsRequested: (event: SecretRequestEvent) => events.push(event),
    });
    const res = response();
    await h.requestSecrets(
      { params: { id: created.id } } as unknown as Request,
      res,
    );
    expect(body(res)).toMatchObject({
      configId: created.id,
      missing: ['NODE_AUTH_TOKEN'],
      requested: true,
    });
    expect(events).toEqual([
      {
        configId: created.id,
        configName: 'web build',
        missing: ['NODE_AUTH_TOKEN'],
      },
    ]);

    const missing = response();
    await h.requestSecrets(
      { params: { id: 'bc-missing' } } as unknown as Request,
      missing,
    );
    expect(status(missing)).toBe(404);
  });

  test('run endpoints are 501s when the run collaborators are not wired', async () => {
    const created = await store.create(FIELDS());
    const h = handlers(store);
    const run = response();
    await h.run({ params: { id: created.id } } as unknown as Request, run);
    expect(status(run)).toBe(501);

    const getRun = response();
    await h.getRun({ params: { id: 'run-1' } } as unknown as Request, getRun);
    expect(status(getRun)).toBe(404);

    const output = response();
    await h.getRunOutput(
      { params: { id: 'run-1' }, query: {} } as unknown as Request,
      output,
    );
    expect(status(output)).toBe(404);
  });

  describe('runs (wired)', () => {
    let checkoutDir: string;
    let runs: {
      resolveSecrets: jest.Mock;
      trackRun: jest.Mock;
      getRun: jest.Mock;
      getOutputBuffer: jest.Mock;
      getOutputSnapshot: jest.Mock;
      getSecretEnvNames: jest.Mock;
      createBuildSession: jest.Mock;
      getBuildRoots: jest.Mock;
      records: Map<string, Record<string, unknown>>;
    };

    const confirmedFields = () => ({
      ...FIELDS(),
      checkout: {
        path: checkoutDir,
        ref: 'main',
        depth: 1,
        reset: 'ff-only' as const,
      },
    });

    const confirm = async (id: string) => {
      const current = await store.get(id);
      if (!current) throw new Error(`missing fixture config ${id}`);
      return store.update(id, {
        secretConfirmation: {
          fingerprint: confirmationFingerprintSource(current),
          envNames: ['NODE_AUTH_TOKEN'],
        },
      });
    };

    beforeEach(async () => {
      checkoutDir = await mkdtemp(join(tmpdir(), 'build-checkout-'));
      const records = new Map<string, Record<string, unknown>>();
      runs = {
        records,
        resolveSecrets: jest.fn(
          async (_repoId: string, decls: Array<{ env: string }>) => ({
            env: Object.fromEntries(
              decls.map((decl) => [decl.env, 'granted-value']),
            ),
            missing: [],
          }),
        ),
        trackRun: jest.fn((input: Record<string, unknown>) => {
          const record = { ...input, status: 'running', startedAt: 'now' };
          records.set(input.runId as string, record);
          return record;
        }),
        getRun: jest.fn((runId: string) => records.get(runId) ?? null),
        getOutputBuffer: jest.fn(async () => ''),
        getOutputSnapshot: jest.fn(() => undefined),
        getSecretEnvNames: jest.fn(() => []),
        createBuildSession: jest.fn(async () => ({ sessionId: 'session-1' })),
        getBuildRoots: jest.fn(async () => ({})),
      };
    });
    afterEach(async () => {
      await rm(checkoutDir, { recursive: true, force: true });
    });

    function wired(store: BuildConfigurationStore, overrides = {}) {
      return handlers(store, {
        getGrantedKeys: async () => ['NODE_AUTH_TOKEN'],
        runs: {
          resolveSecrets: runs.resolveSecrets,
          trackRun: runs.trackRun,
          getRun: runs.getRun,
          getOutputBuffer: runs.getOutputBuffer,
          getOutputSnapshot: runs.getOutputSnapshot,
          getSecretEnvNames: runs.getSecretEnvNames,
          createBuildSession: runs.createBuildSession,
          getBuildRoots: runs.getBuildRoots,
        },
        ...overrides,
      });
    }

    test('starts a confirmed run and reads it back', async () => {
      const created = await store.create(confirmedFields());
      await confirm(created.id);
      const h = wired(store);
      const run = response();
      await h.run({ params: { id: created.id } } as unknown as Request, run);
      expect(status(run)).toBe(201);
      const started = body(run);
      expect(started).toMatchObject({
        configId: created.id,
        terminalSessionId: 'session-1',
        status: 'running',
      });
      expect(runs.createBuildSession).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: checkoutDir,
          context: `build:${created.id}`,
          env: { NODE_AUTH_TOKEN: 'granted-value' },
        }),
      );
      expect(
        String(runs.createBuildSession.mock.calls[0][0].command),
      ).toContain('npm run build');

      const fetched = response();
      await h.getRun(
        { params: { id: started.runId } } as unknown as Request,
        fetched,
      );
      expect(body(fetched).run).toMatchObject({ runId: started.runId });

      runs.getOutputBuffer.mockResolvedValue(
        '\u001b[31mcompile failed: granted-value\u001b[0m\r\n',
      );
      runs.getSecretEnvNames.mockReturnValue(['NODE_AUTH_TOKEN']);
      const output = response();
      await h.getRunOutput(
        {
          params: { id: started.runId },
          query: { tailBytes: '1000' },
        } as unknown as Request,
        output,
      );
      expect(body(output)).toMatchObject({
        success: true,
        runId: started.runId,
        terminalSessionId: 'session-1',
        output: 'compile failed: [REDACTED]\n',
        truncated: false,
      });
      expect(runs.resolveSecrets).toHaveBeenLastCalledWith(
        `build:${created.id}`,
        [{ env: 'NODE_AUTH_TOKEN', label: 'NODE_AUTH_TOKEN', required: true }],
        { configId: created.id, runId: started.runId },
      );

      runs.resolveSecrets.mockResolvedValue({
        env: {},
        missing: ['NODE_AUTH_TOKEN'],
      });
      const unsafeOutput = response();
      await h.getRunOutput(
        {
          params: { id: started.runId },
          query: {},
        } as unknown as Request,
        unsafeOutput,
      );
      expect(status(unsafeOutput)).toBe(409);
      expect(body(unsafeOutput).error).toMatch(/redaction/);

      runs.getOutputSnapshot.mockReturnValue('saved output: [REDACTED]\n');
      const savedOutput = response();
      await h.getRunOutput(
        {
          params: { id: started.runId },
          query: {},
        } as unknown as Request,
        savedOutput,
      );
      expect(body(savedOutput).output).toBe('saved output: [REDACTED]\n');

      const invalidLimit = response();
      await h.getRunOutput(
        {
          params: { id: started.runId },
          query: { tailBytes: '999999' },
        } as unknown as Request,
        invalidLimit,
      );
      expect(status(invalidLimit)).toBe(400);

      const missing = response();
      await h.getRun(
        { params: { id: 'run-nope' } } as unknown as Request,
        missing,
      );
      expect(status(missing)).toBe(404);
    });

    test('refuses unconfirmed configs, unregistered repos, and missing checkouts', async () => {
      const unconfirmed = await store.create(FIELDS());
      const h = wired(store);
      const unconfirmedRun = response();
      await h.run(
        { params: { id: unconfirmed.id } } as unknown as Request,
        unconfirmedRun,
      );
      expect(status(unconfirmedRun)).toBe(400);

      const unregistered = await store.create({
        ...confirmedFields(),
        repo: 'pkg:github/owner/elsewhere',
      });
      await confirm(unregistered.id);
      const repoRun = response();
      await h.run(
        { params: { id: unregistered.id } } as unknown as Request,
        repoRun,
      );
      expect(status(repoRun)).toBe(400);

      const noCheckout = await store.create({
        ...confirmedFields(),
        checkout: {
          path: join(checkoutDir, 'gone'),
          ref: 'main',
          depth: 1,
          reset: 'ff-only' as const,
        },
      });
      await confirm(noCheckout.id);
      const diskRun = response();
      await h.run(
        { params: { id: noCheckout.id } } as unknown as Request,
        diskRun,
      );
      expect(status(diskRun)).toBe(400);

      const unknown = response();
      await h.run(
        { params: { id: 'bc-missing' } } as unknown as Request,
        unknown,
      );
      expect(status(unknown)).toBe(404);
    });

    test('409s on missing secrets and on a windowless app', async () => {
      const created = await store.create(confirmedFields());
      await confirm(created.id);
      const ungranted = wired(store, { getGrantedKeys: async () => [] });
      const denied = response();
      await ungranted.run(
        { params: { id: created.id } } as unknown as Request,
        denied,
      );
      expect(status(denied)).toBe(409);
      expect(body(denied).missing).toEqual(['NODE_AUTH_TOKEN']);

      const windowless = wired(store, {
        runs: {
          resolveSecrets: runs.resolveSecrets,
          trackRun: runs.trackRun,
          getRun: runs.getRun,
          getOutputBuffer: runs.getOutputBuffer,
          getOutputSnapshot: runs.getOutputSnapshot,
          getSecretEnvNames: runs.getSecretEnvNames,
          createBuildSession: jest.fn(async () => {
            throw new Error('no live application window to own the terminal');
          }),
          getBuildRoots: runs.getBuildRoots,
        },
      });
      const noWindow = response();
      await windowless.run(
        { params: { id: created.id } } as unknown as Request,
        noWindow,
      );
      expect(status(noWindow)).toBe(409);
    });
  });
});
