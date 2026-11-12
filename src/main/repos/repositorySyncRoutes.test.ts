/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import {
  registerRepositorySyncRoutes,
  type RepositorySyncRouteDependencies,
} from './repositorySyncRoutes';

const registeredPath = '/Users/me/Development/repo';
const entry = { path: registeredPath } as AlexandriaEntry;

function setup(deps: RepositorySyncRouteDependencies = {}) {
  const post = jest.fn();
  const registry = {
    getRepositories: jest.fn().mockResolvedValue([entry]),
  };
  registerRepositorySyncRoutes(
    { post } as unknown as Application,
    registry as unknown as AlexandriaRegistryService,
    deps,
  );
  const call = post.mock.calls.find(([route]) => route === '/api/repos/sync');
  return {
    handler: call?.[1] as (req: Request, res: Response) => Promise<void>,
    registry,
  };
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

test('defaults to dry-run on all registered repositories', async () => {
  const syncRepository = jest.fn().mockResolvedValue({
    path: registeredPath,
    status: 'fast-forwardable',
    remotes: [],
  });
  const { handler } = setup({ syncRepository });
  const res = response();

  await handler({ body: {} } as Request, res as unknown as Response);

  expect(syncRepository).toHaveBeenCalledWith(
    registeredPath,
    { apply: false },
    undefined,
  );
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      apply: false,
      summary: {
        requested: 1,
        fastForwarded: 0,
        fastForwardable: 1,
        upToDate: 0,
        skipped: 0,
      },
    }),
  );
});

test('allows requested paths only when they are registered', async () => {
  const syncRepository = jest.fn();
  const { handler } = setup({ syncRepository });
  const res = response();

  await handler(
    { body: { paths: ['/tmp/not-registered'] } } as Request,
    res as unknown as Response,
  );

  expect(res.status).toHaveBeenCalledWith(400);
  expect(syncRepository).not.toHaveBeenCalled();
});

test('rejects malformed paths and apply values', async () => {
  const { handler } = setup();
  for (const body of [{ apply: 'true' }, { paths: [] }, { paths: [7] }]) {
    const res = response();
    await handler({ body } as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  }
});
