/** @jest-environment node */
jest.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: jest.fn(), getAllWindows: () => [] },
}));
jest.mock('./sessionManagerSingleton', () => ({
  getSessionManagerInstance: jest.fn(),
}));
jest.mock('../processes/ProcessRegistry', () => ({
  getProcessRegistry: jest.fn(),
}));

import type { Application, Request, Response } from 'express';
import { getSessionManagerInstance } from './sessionManagerSingleton';
import { registerTerminalRoutes } from './terminalRoutes';

type Handler = (req: Request, res: Response) => unknown;

function routes() {
  const get = jest.fn();
  const post = jest.fn();
  const del = jest.fn();
  registerTerminalRoutes({ get, post, delete: del } as unknown as Application);
  const byPath = (calls: jest.Mock, path: string) =>
    calls.mock.calls.find(([routePath]) => routePath === path)?.[1] as Handler;
  return {
    getTerminals: byPath(get, '/api/terminals'),
    getStatus: byPath(get, '/api/terminals/:id/status'),
  };
}

function response() {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('GET /api/terminals/:id/status', () => {
  beforeEach(() => {
    jest.mocked(getSessionManagerInstance).mockReturnValue({
      hasSession: (id: string) => id === 'session-1',
      getSession: (id: string) =>
        id === 'session-1'
          ? { id, directory: '/repo', lastActivity: 123 }
          : undefined,
      getProgramStatus: (id: string) =>
        id === 'session-1'
          ? [{ state: 'working', app: 'principal-build' }]
          : [],
    } as never);
  });

  test('returns liveness and program status', async () => {
    const { getStatus } = routes();
    const res = response();
    await getStatus({ params: { id: 'session-1' } } as unknown as Request, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      sessionId: 'session-1',
      alive: true,
      programStatus: [{ state: 'working', app: 'principal-build' }],
      lastActivity: 123,
    });
  });

  test('unknown sessions are 404', async () => {
    const { getStatus } = routes();
    const res = response();
    await getStatus({ params: { id: 'missing' } } as unknown as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
