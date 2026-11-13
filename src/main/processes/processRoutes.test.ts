/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import type { ProcessRegistry } from './ProcessRegistry';
import { registerProcessRoutes } from './processRoutes';
import { detectRunningServers } from './detectServers';

jest.mock('./detectServers', () => ({
  COMMON_DEV_PORTS: [3000, 5173],
  detectRunningServers: jest.fn(),
}));

const mockScan = detectRunningServers as jest.Mock;

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

function detectedHandler(registry: Partial<ProcessRegistry>) {
  const get = jest.fn();
  registerProcessRoutes(
    {
      get,
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as unknown as Application,
    registry as ProcessRegistry,
  );
  const call = get.mock.calls.find(
    ([routePath]) => routePath === '/api/processes/detected',
  );
  expect(call).toBeTruthy();
  if (!call) throw new Error('detected route not registered');
  return call[1] as (req: Request, res: Response) => Promise<void>;
}

beforeEach(() => {
  mockScan.mockReset();
});

test('GET /api/processes/detected merges scan results and drops managed pid/port matches', async () => {
  mockScan.mockResolvedValue({
    servers: [
      {
        port: 3000,
        protocol: 'http',
        responsive: true,
        label: 'app',
        pid: 111,
        cwd: '/repo/app',
        command: 'node',
      },
      {
        port: 5173,
        protocol: 'http',
        responsive: true,
        label: 'vite',
        pid: 222,
        cwd: '',
        command: 'vite',
      },
      {
        port: 8080,
        protocol: 'http',
        responsive: true,
        label: 'other',
        pid: 333,
        command: 'node',
      },
    ],
    scannedPorts: [3000, 5173, 8080],
    scanDuration: 12,
  });
  const registry = {
    list: () => [
      { id: 'managed-1', status: 'running', pid: 111, port: 3000 },
      { id: 'managed-2', status: 'stopped', pid: 999, port: 9999 },
    ],
    getDetectedLabel: () => undefined,
    resolveRepo: jest.fn(async () => undefined),
  } as unknown as ProcessRegistry;
  const handler = detectedHandler(registry);
  const res = response();

  await handler(
    { query: {} } as unknown as Request,
    res as unknown as Response,
  );

  expect(mockScan).toHaveBeenCalledWith({
    ports: [3000, 5173],
    timeout: undefined,
  });
  const body = res.json.mock.calls[0][0];
  expect(body.success).toBe(true);
  expect(body.scannedPorts).toEqual([3000, 5173, 8080]);
  expect(body.servers).toHaveLength(2);
  expect(body.processes.map((p: { id: string }) => p.id).sort()).toEqual([
    'detected:222',
    'detected:333',
  ]);
  expect(body.processes[0]).toMatchObject({
    origin: 'detected',
    status: 'running',
    source: 'external',
  });
});

test('GET /api/processes/detected applies display-name overrides and repo attribution', async () => {
  mockScan.mockResolvedValue({
    servers: [
      {
        port: 5173,
        protocol: 'http',
        responsive: true,
        label: 'vite',
        pid: 222,
        cwd: '/repo/app',
        command: 'vite',
      },
    ],
    scannedPorts: [5173],
    scanDuration: 5,
  });
  const registry = {
    list: () => [],
    getDetectedLabel: (id: string) =>
      id === 'detected:222' ? 'Custom name' : undefined,
    resolveRepo: jest.fn(async () => ({ name: 'app' })),
  } as unknown as ProcessRegistry;
  const handler = detectedHandler(registry);
  const res = response();

  await handler(
    { query: { ports: '5173', timeout: '250' } } as unknown as Request,
    res as unknown as Response,
  );

  expect(mockScan).toHaveBeenCalledWith({ ports: [5173], timeout: 250 });
  const body = res.json.mock.calls[0][0];
  expect(body.processes[0]).toMatchObject({
    id: 'detected:222',
    label: 'Custom name',
    repo: { name: 'app' },
  });
  expect(body.servers[0]).toMatchObject({ displayName: 'Custom name' });
});

test.each([
  { ports: 'abc' },
  { ports: '0' },
  { timeout: '10' },
  {
    ports:
      '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101',
  },
])('GET /api/processes/detected rejects invalid query: %p', async (query) => {
  const handler = detectedHandler({
    list: () => [],
  } as unknown as ProcessRegistry);
  const res = response();

  await handler({ query } as unknown as Request, res as unknown as Response);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(mockScan).not.toHaveBeenCalled();
});

test('GET /api/processes/detected surfaces scan failures as 500', async () => {
  mockScan.mockRejectedValue(new Error('boom'));
  const handler = detectedHandler({
    list: () => [],
  } as unknown as ProcessRegistry);
  const res = response();

  await handler(
    { query: {} } as unknown as Request,
    res as unknown as Response,
  );

  expect(res.status).toHaveBeenCalledWith(500);
});
