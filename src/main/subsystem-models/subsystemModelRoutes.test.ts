/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { SubsystemModelRegistryService } from '../stores/SubsystemModelRegistryService';
import { registerSubsystemModelRoutes } from './subsystemModelRoutes';

function handler(registry: Pick<SubsystemModelRegistryService, 'getModel'>) {
  const get = jest.fn();
  registerSubsystemModelRoutes({ get } as unknown as Application, registry);
  expect(get).toHaveBeenCalledWith(
    '/api/subsystem-models/:id',
    expect.any(Function),
  );
  return get.mock.calls[0][1] as (req: Request, res: Response) => Promise<void>;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

test('returns the full model for the stable ID', async () => {
  const model = {
    id: 'sg-1-abc',
    title: 'Example',
    components: [],
    trails: [],
  };
  const registry = { getModel: jest.fn().mockResolvedValue(model) };
  const res = response();
  await handler(registry)(
    { params: { id: model.id } } as unknown as Request,
    res as unknown as Response,
  );
  expect(registry.getModel).toHaveBeenCalledWith(model.id);
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ success: true, model });
});

test.each(['sg-1-missing', '../secrets', ''])(
  'returns 404 for unknown or invalid model %s',
  async (id) => {
    const res = response();
    await handler({ getModel: jest.fn().mockResolvedValue(null) })(
      { params: { id } } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'unknown or invalid subsystem model id',
    });
  },
);

test('returns a generic error if the registry fails', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = response();
    await handler({
      getModel: jest.fn().mockRejectedValue(new Error('disk failed')),
    })(
      { params: { id: 'sg-1-abc' } } as unknown as Request,
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'failed to read subsystem model',
    });
  } finally {
    log.mockRestore();
  }
});
