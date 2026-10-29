/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import type { Application, Request, Response } from 'express';
import { registerCatalogRoutes } from './catalogRoutes';
import { bridgeRouteCatalog, MAX_ROUTE_LOOKUPS } from './routeCatalog';

function handlers() {
  const get = jest.fn();
  const post = jest.fn();
  registerCatalogRoutes({ get, post } as unknown as Application, 3054);
  expect(get).toHaveBeenCalledWith('/routes', expect.any(Function));
  expect(post).toHaveBeenCalledWith('/routes', expect.any(Function));
  return {
    get: get.mock.calls[0][1] as (req: Request, res: Response) => void,
    post: post.mock.calls[0][1] as (req: Request, res: Response) => void,
  };
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function lookup(body: unknown) {
  const res = response();
  handlers().post({ body } as Request, res as unknown as Response);
  return res;
}

test('GET discovers every category and route without returning detailed contracts', () => {
  const res = response();
  handlers().get({} as Request, res as unknown as Response);
  const result = res.json.mock.calls[0][0];
  expect(result).toMatchObject({
    service: 'Principal MCP Bridge',
    port: 3054,
    lookup: { method: 'POST', path: '/routes', maxRoutes: MAX_ROUTE_LOOKUPS },
  });
  expect(result.groups).toEqual(
    bridgeRouteCatalog.map(({ name, description, routes }) => ({
      name,
      description,
      routes: routes.map(({ method, path: routePath, summary }) => ({
        method,
        path: routePath,
        summary,
      })),
    })),
  );
  for (const group of result.groups) {
    for (const route of group.routes) {
      expect(Object.keys(route).sort()).toEqual(['method', 'path', 'summary']);
    }
  }
});

test('POST returns the requested contracts in request order, normalizing method case', () => {
  const res = lookup({
    routes: [
      { method: 'post', path: '/api/topics' },
      { path: '/api/processes/:id/logs' },
    ],
  });
  expect(res.status).not.toHaveBeenCalled();
  const result = res.json.mock.calls[0][0];
  expect(result.success).toBe(true);
  expect(result.results).toHaveLength(2);
  expect(result.results[0]).toMatchObject({
    request: { method: 'POST', path: '/api/topics' },
    found: true,
    routes: [
      {
        category: 'topics',
        method: 'POST',
        path: '/api/topics',
        body: {
          title: expect.any(String),
          references: expect.stringContaining('c4-sketch'),
        },
        response: expect.stringContaining('201'),
        errors: { '400': expect.any(String) },
        notes: expect.any(Array),
        example: { title: expect.any(String) },
      },
    ],
  });
  expect(result.results[1]).toMatchObject({
    request: { path: '/api/processes/:id/logs' },
    found: true,
    routes: [{ method: 'GET', category: 'processes' }],
  });
});

test('omitting method returns every documented method on the exact path', () => {
  const res = lookup({ routes: [{ path: '/api/topics' }] });
  const [result] = res.json.mock.calls[0][0].results;
  expect(
    result.routes.map((route: { method: string }) => route.method),
  ).toEqual(['GET', 'POST']);
});

test('unknown paths and methods do not fail known entries in the batch', () => {
  const res = lookup({
    routes: [
      { path: '/missing' },
      { method: 'PUT', path: '/api/topics' },
      { method: 'GET', path: '/health' },
    ],
  });
  expect(res.status).not.toHaveBeenCalled();
  const { success, results } = res.json.mock.calls[0][0];
  expect(success).toBe(true);
  expect(results[0]).toMatchObject({
    found: false,
    routes: [],
    error: expect.any(String),
  });
  expect(results[1]).toMatchObject({
    found: false,
    routes: [],
    error: expect.any(String),
  });
  expect(results[2]).toMatchObject({ found: true });
});

test.each(['/api/topics/topic-123', '/api/topics/*', '/api'])(
  'does not expand concrete IDs, globs, or prefixes: %s',
  (routePath) => {
    const res = lookup({ routes: [{ path: routePath }] });
    expect(res.json.mock.calls[0][0].results[0]).toMatchObject({
      found: false,
      routes: [],
    });
  },
);

test('lookups are read-only, include DELETE documentation, and preserve duplicate requests', () => {
  const before = JSON.stringify(bridgeRouteCatalog);
  const request = { method: 'DELETE', path: '/api/topics/:id' };
  const res = lookup({ routes: [request, request] });
  const { results } = res.json.mock.calls[0][0];
  expect(results).toHaveLength(2);
  expect(results[0]).toEqual(results[1]);
  expect(results[0]).toMatchObject({
    found: true,
    routes: [{ method: 'DELETE' }],
  });
  expect(JSON.stringify(bridgeRouteCatalog)).toBe(before);
});

test.each([
  undefined,
  null,
  [],
  'routes',
  {},
  { routes: [] },
  { routes: '/health' },
  {
    routes: Array.from({ length: MAX_ROUTE_LOOKUPS + 1 }, () => ({
      path: '/health',
    })),
  },
])('rejects invalid batch bodies: %p', (body) => {
  const res = lookup(body);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error: expect.any(String),
  });
});

test.each([
  null,
  [],
  '/health',
  {},
  { path: 1 },
  { path: '' },
  { path: 'health' },
  { path: 'http://localhost:3044/health' },
  { path: '//health' },
  { path: '/api//topics' },
  { path: '/health?q=x' },
  { path: '/health#x' },
  { path: '/health ' },
  { path: '/health\n' },
  { path: '/health\\x' },
  { path: '/health', method: null },
  { path: '/health', method: 1 },
  { path: '/health', method: '' },
  { path: '/health', method: 'EXECUTE' },
])(
  'rejects a malformed entry without producing partial results: %p',
  (entry) => {
    const res = lookup({ routes: [{ path: '/health' }, entry] });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('routes[1]'),
    });
  },
);

test('accepts a batch at the size limit', () => {
  const res = lookup({
    routes: Array.from({ length: MAX_ROUTE_LOOKUPS }, () => ({
      path: '/health',
    })),
  });
  expect(res.status).not.toHaveBeenCalled();
  expect(res.json.mock.calls[0][0].results).toHaveLength(MAX_ROUTE_LOOKUPS);
});

test('the catalog documents itself', () => {
  const res = lookup({ routes: [{ path: '/routes' }] });
  expect(res.json.mock.calls[0][0].results[0].routes).toEqual([
    expect.objectContaining({ method: 'GET', response: expect.any(String) }),
    expect.objectContaining({
      method: 'POST',
      body: { routes: expect.any(String) },
    }),
  ]);
});

test('catalog method/path pairs exactly cover all mounted bridge route registrations', () => {
  const bridgePath = path.join(__dirname, 'PrincipalMCPBridge.ts');
  const bridge = fs.readFileSync(bridgePath, 'utf8');
  // Discover mounted route modules from the bridge, so adding another route
  // group also requires documenting it instead of silently escaping this test.
  const modules = [
    ...bridge.matchAll(
      /import\s+\{\s*(register\w+Routes)\s*\}\s+from\s+['"]([^'"]+)['"]/g,
    ),
  ];
  expect(modules.length).toBeGreaterThan(0);
  const sources = [bridge];
  for (const [, register, modulePath] of modules) {
    expect(bridge).toContain(`${register}(this.app`);
    sources.push(
      fs.readFileSync(path.resolve(__dirname, `${modulePath}.ts`), 'utf8'),
    );
  }
  const mounted = sources.flatMap((source) =>
    [
      ...source.matchAll(
        /(?:this\.)?app\.(get|post|patch|delete|put)\(\s*['"]([^'"]+)['"]/g,
      ),
    ].map(([, method, routePath]) => `${method.toUpperCase()} ${routePath}`),
  );
  const documented = bridgeRouteCatalog.flatMap((group) =>
    group.routes.map((route) => `${route.method} ${route.path}`),
  );
  expect(new Set(documented).size).toBe(documented.length);
  expect(documented.sort()).toEqual(mounted.sort());
  for (const group of bridgeRouteCatalog) {
    expect(group.description).toBeTruthy();
    for (const route of group.routes) {
      expect(route.summary).toBeTruthy();
      expect(route.response).toBeTruthy();
    }
  }
});
