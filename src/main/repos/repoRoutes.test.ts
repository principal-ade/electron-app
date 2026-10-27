/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { promises as fsPromises } from 'fs';
import { registerRepoRoutes, type RepoRouteDependencies } from './repoRoutes';

const BASE = '/Users/me/Development';

function entry(repoPath: string, name = 'repo'): AlexandriaEntry {
  return {
    path: repoPath,
    name,
    registeredAt: '2026-01-01T00:00:00.000Z',
    hasViews: false,
    viewCount: 0,
  } as unknown as AlexandriaEntry;
}

interface SetupOptions {
  deps?: RepoRouteDependencies;
  getRepositoryByPath?: (repoPath: string) => Promise<AlexandriaEntry | null>;
  registerRepository?: (
    repoPath: string,
    remoteUrl?: string,
  ) => Promise<AlexandriaEntry>;
}

/** Register the routes on a fake express app and hand back the clone handler. */
function setup(options: SetupOptions = {}) {
  const registry = {
    getRepositories: jest.fn().mockResolvedValue([]),
    getRepositoryByPath: jest.fn(
      options.getRepositoryByPath ?? (async () => null),
    ),
    registerRepository: jest.fn(
      options.registerRepository ?? (async (repoPath: string) => entry(repoPath)),
    ),
    removeRepository: jest.fn(),
  };
  const deps: RepoRouteDependencies = {
    cloneRepository: jest.fn().mockResolvedValue(undefined),
    getBaseDefaultDirectory: jest.fn().mockResolvedValue(BASE),
    ...options.deps,
  };

  const post = jest.fn();
  registerRepoRoutes(
    { get: jest.fn(), post, delete: jest.fn() } as unknown as Application,
    registry as unknown as AlexandriaRegistryService,
    deps,
  );

  const cloneCall = post.mock.calls.find(
    ([route]) => route === '/api/repos/clone',
  );
  expect(cloneCall).toBeDefined();

  return {
    clone: cloneCall?.[1] as (req: Request, res: Response) => Promise<void>,
    registry,
    deps,
  };
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

async function clone(body: unknown, options: SetupOptions = {}) {
  const ctx = setup(options);
  const res = response();
  await ctx.clone({ body } as Request, res as unknown as Response);
  return { ...ctx, res, payload: res.json.mock.calls[0]?.[0] };
}

// repoRoutes checks target paths with `fs.promises.stat`; default to "absent".
let statSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  statSpy = jest
    .spyOn(fsPromises, 'stat')
    .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
});

afterEach(() => {
  statSpy.mockRestore();
});

test('clones each identifier into the base directory convention and registers it', async () => {
  const { res, payload, deps, registry } = await clone({
    repos: ['pkg:github/acme/web', 'acme/api'],
  });

  expect(res.status).toHaveBeenCalledWith(200);
  expect(deps.cloneRepository).toHaveBeenCalledTimes(2);
  expect(deps.cloneRepository).toHaveBeenNthCalledWith(
    1,
    'https://github.com/acme/web.git',
    `${BASE}/acme/web`,
    { depth: undefined },
  );
  expect(deps.cloneRepository).toHaveBeenNthCalledWith(
    2,
    'https://github.com/acme/api.git',
    `${BASE}/acme/api`,
    { depth: undefined },
  );
  expect(registry.registerRepository).toHaveBeenCalledWith(
    `${BASE}/acme/web`,
    'https://github.com/acme/web.git',
  );
  expect(payload).toMatchObject({
    success: true,
    baseDirectory: BASE,
    summary: { requested: 2, cloned: 2, alreadyRegistered: 0, failed: 0 },
  });
  expect(payload.results[0]).toMatchObject({
    request: 'pkg:github/acme/web',
    ok: true,
    action: 'cloned',
    path: `${BASE}/acme/web`,
  });
});

test('a single identifier can be sent as body.repo, with shallow depth', async () => {
  const { deps, payload } = await clone({ repo: 'acme/web', depth: 1 });

  expect(deps.cloneRepository).toHaveBeenCalledWith(
    'https://github.com/acme/web.git',
    `${BASE}/acme/web`,
    { depth: 1 },
  );
  expect(payload.summary.cloned).toBe(1);
});

test('skips the network for repos that are already registered', async () => {
  const registered = entry(`${BASE}/acme/web`, 'web');
  const { deps, payload } = await clone(
    { repos: ['acme/web'] },
    { getRepositoryByPath: async () => registered },
  );

  expect(deps.cloneRepository).not.toHaveBeenCalled();
  expect(payload.success).toBe(true);
  expect(payload.results[0]).toMatchObject({
    ok: true,
    action: 'alreadyRegistered',
    path: `${BASE}/acme/web`,
  });
  expect(payload.summary.alreadyRegistered).toBe(1);
});

test('reports per-entry parse errors without failing the whole batch', async () => {
  const { deps, payload } = await clone({
    repos: ['pkg:generic/local/Users-me-app', 'acme/web'],
  });

  expect(deps.cloneRepository).toHaveBeenCalledTimes(1);
  expect(payload.success).toBe(false);
  expect(payload.summary).toMatchObject({ requested: 2, cloned: 1, failed: 1 });
  expect(payload.results[0]).toMatchObject({ ok: false });
  expect(payload.results[0].error).toContain('cannot clone a generic PURL');
  expect(payload.results[1]).toMatchObject({ ok: true, action: 'cloned' });
});

test('reports clone failures per entry and keeps going', async () => {
  const cloneRepository = jest
    .fn()
    .mockRejectedValueOnce(new Error('authentication failed'))
    .mockResolvedValueOnce(undefined);

  const { payload } = await clone(
    { repos: ['acme/web', 'acme/api'] },
    { deps: { cloneRepository } },
  );

  expect(payload.success).toBe(false);
  expect(payload.results[0]).toMatchObject({ ok: false });
  expect(payload.results[0].error).toContain('authentication failed');
  expect(payload.results[1]).toMatchObject({ ok: true, action: 'cloned' });
});

test('refuses to clone over an existing unregistered directory', async () => {
  statSpy.mockResolvedValue({} as never);

  const { deps, payload } = await clone({ repos: ['acme/web'] });

  expect(deps.cloneRepository).not.toHaveBeenCalled();
  expect(payload.success).toBe(false);
  expect(payload.results[0].error).toContain('already exists');
});

test('surfaces a registration failure without hiding the clone', async () => {
  const { deps, payload } = await clone(
    { repos: ['acme/web'] },
    {
      registerRepository: async () => {
        throw new Error('no remote detected');
      },
    },
  );

  expect(deps.cloneRepository).toHaveBeenCalledTimes(1);
  expect(payload.results[0]).toMatchObject({ ok: true, action: 'cloned' });
  expect(payload.results[0].registerError).toContain('no remote detected');
});

test('skips registration when register is false', async () => {
  const { registry, payload } = await clone({
    repos: ['acme/web'],
    register: false,
  });

  expect(registry.registerRepository).not.toHaveBeenCalled();
  expect(payload.results[0]).toMatchObject({ ok: true, action: 'cloned' });
  expect(payload.results[0].repo).toBeUndefined();
});

test.each([undefined, null, {}, { repos: [] }, { repos: ['  '] }])(
  'rejects an empty or malformed batch: %p',
  async (body) => {
    const { res, payload } = await clone(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('body.repos');
  },
);

test('rejects a batch above the limit', async () => {
  const { deps, res, payload } = await clone({
    repos: Array.from({ length: 21 }, (_, i) => `acme/repo-${i}`),
  });

  expect(res.status).toHaveBeenCalledWith(400);
  expect(payload.error).toContain('at most 20');
  expect(deps.cloneRepository).not.toHaveBeenCalled();
});

test('explains how to fix a missing base directory', async () => {
  const { res, payload, deps } = await clone(
    { repos: ['acme/web'] },
    { deps: { getBaseDefaultDirectory: jest.fn().mockResolvedValue(undefined) } },
  );

  expect(res.status).toHaveBeenCalledWith(400);
  expect(payload.error).toContain('Settings → General');
  expect(deps.cloneRepository).not.toHaveBeenCalled();
});

test('never writes outside the base directory', async () => {
  const { deps } = await clone({ repos: ['../acme', 'pkg:github/../../x'] });
  expect(deps.cloneRepository).not.toHaveBeenCalled();
});

describe('DELETE /api/repos', () => {
  function removeHandler(options: SetupOptions = {}) {
    const deleteFn = jest.fn();
    const registry = {
      getRepositories: jest.fn(),
      getRepositoryByPath: jest.fn(
        options.getRepositoryByPath ?? (async () => null),
      ),
      registerRepository: jest.fn(),
      removeRepository: jest.fn().mockResolvedValue(true),
    };
    const deps: RepoRouteDependencies = {
      cloneRepository: jest.fn(),
      getBaseDefaultDirectory: jest.fn().mockResolvedValue(BASE),
      ...options.deps,
    };
    registerRepoRoutes(
      { get: jest.fn(), post: jest.fn(), delete: deleteFn } as unknown as Application,
      registry as unknown as AlexandriaRegistryService,
      deps,
    );
    const call = deleteFn.mock.calls.find(([route]) => route === '/api/repos');
    expect(call).toBeDefined();
    return {
      handler: call?.[1] as (req: Request, res: Response) => Promise<void>,
      registry,
    };
  }

  const removedEntry = entry(`${BASE}/acme/web`, 'web');

  test('unregisters by default without touching the checkout', async () => {
    const { handler, registry } = removeHandler({
      getRepositoryByPath: async () => removedEntry,
    });
    const res = response();

    await handler(
      { query: { path: `${BASE}/acme/web` } } as unknown as Request,
      res as unknown as Response,
    );

    expect(registry.removeRepository).toHaveBeenCalledWith(
      `${BASE}/acme/web`,
      false,
    );
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: true,
      deleteLocal: false,
    });
  });

  test('deleteLocal=true deletes a registered git checkout', async () => {
    statSpy.mockImplementation(async (target: never) => {
      if (String(target).endsWith('.git')) return { isDirectory: () => true };
      return {} as never;
    });
    const { handler, registry } = removeHandler({
      getRepositoryByPath: async () => removedEntry,
    });
    const res = response();

    await handler(
      {
        query: { path: `${BASE}/acme/web`, deleteLocal: 'true' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(registry.removeRepository).toHaveBeenCalledWith(
      `${BASE}/acme/web`,
      true,
    );
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: true,
      deleteLocal: true,
    });
  });

  test('refuses deleteLocal for a directory that is not a git checkout', async () => {
    const { handler, registry } = removeHandler({
      getRepositoryByPath: async () => removedEntry,
    });
    const res = response();

    await handler(
      {
        query: { path: `${BASE}/acme/web`, deleteLocal: 'true' },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('no git repository');
    expect(registry.removeRepository).not.toHaveBeenCalled();
  });

  test('refuses deleteLocal for the base directory or home', async () => {
    for (const target of [BASE, process.env.HOME ?? '/root']) {
      const { handler, registry } = removeHandler({
        getRepositoryByPath: async () => entry(target),
      });
      const res = response();

      await handler(
        { query: { path: target, deleteLocal: 'true' } } as unknown as Request,
        res as unknown as Response,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toContain('refusing to delete');
      expect(registry.removeRepository).not.toHaveBeenCalled();
    }
  });

  test('reports an unknown path as 404', async () => {
    const { handler, registry } = removeHandler();
    const res = response();

    await handler(
      { query: { path: `${BASE}/nope` } } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(registry.removeRepository).not.toHaveBeenCalled();
  });
});
