/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import {
  registerRepositoryDiffRoutes,
  type RepositoryDiffRouteDependencies,
} from './repositoryDiffRoutes';

const registeredPath = '/Users/me/Development/repo';
const entry = { path: registeredPath } as AlexandriaEntry;

function setup(deps: RepositoryDiffRouteDependencies = {}) {
  const post = jest.fn();
  const registry = {
    getRepositories: jest.fn().mockResolvedValue([entry]),
  };
  registerRepositoryDiffRoutes(
    { post } as unknown as Application,
    registry as unknown as AlexandriaRegistryService,
    deps,
  );
  const call = post.mock.calls.find(([route]) => route === '/api/repos/diffs');
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

test('inspects all registered repositories with default diff options', async () => {
  const inspectRepositoryDiff = jest.fn().mockResolvedValue({
    path: registeredPath,
    clean: true,
    porcelain: [],
    untracked: [],
    staged: [],
    unstaged: [],
    diffs: [],
  });
  const { handler } = setup({ inspectRepositoryDiff });
  const res = response();

  await handler({ body: {} } as Request, res as unknown as Response);

  expect(inspectRepositoryDiff).toHaveBeenCalledWith(
    registeredPath,
    expect.objectContaining({
      includeStaged: true,
      includeUnstaged: true,
      includeUpstream: false,
    }),
    undefined,
  );
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      summary: { requested: 1, clean: 1, dirty: 0, failed: 0 },
    }),
  );
});

test('rejects unknown paths and invalid diff options', async () => {
  const { handler } = setup();
  const unknownRes = response();
  await handler(
    { body: { paths: ['/tmp/not-registered'] } } as Request,
    unknownRes as unknown as Response,
  );
  expect(unknownRes.status).toHaveBeenCalledWith(400);

  for (const body of [
    { contextLines: 99 },
    { maxBytes: 1 },
    { includeStaged: 'yes' },
    { paths: [] },
  ]) {
    const res = response();
    await handler({ body } as Request, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  }
});
