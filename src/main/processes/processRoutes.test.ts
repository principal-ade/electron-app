/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { ProcessRegistry } from './ProcessRegistry';
import { registerProcessRoutes } from './processRoutes';

function patchHandler(registry: Partial<ProcessRegistry>) {
  const patch = jest.fn();
  registerProcessRoutes(
    {
      get: jest.fn(),
      post: jest.fn(),
      patch,
      delete: jest.fn(),
    } as unknown as Application,
    registry as ProcessRegistry,
  );
  expect(patch).toHaveBeenCalledWith(
    '/api/processes/:id',
    expect.any(Function),
  );
  return patch.mock.calls[0][1] as (req: Request, res: Response) => void;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

test.each(['process-1', 'detected:5173'])('PATCH renames process %s', (id) => {
  const setLabel = jest.fn(() => ({ success: true }));
  const handler = patchHandler({ setLabel } as unknown as ProcessRegistry);
  const res = response();

  handler(
    {
      params: { id },
      body: { label: 'Frontend server' },
    } as unknown as Request,
    res as unknown as Response,
  );

  expect(setLabel).toHaveBeenCalledWith(id, 'Frontend server');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ success: true });
});

test.each([undefined, null, {}, { label: '' }, { label: '  ' }, { label: 1 }])(
  'PATCH rejects an invalid display name: %p',
  (body) => {
    const setLabel = jest.fn();
    const handler = patchHandler({ setLabel } as unknown as ProcessRegistry);
    const res = response();

    handler(
      { params: { id: 'process-1' }, body } as unknown as Request,
      res as unknown as Response,
    );

    expect(setLabel).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  },
);
