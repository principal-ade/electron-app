import type { Application } from 'express';
import { bridgeRouteCatalog, MAX_ROUTE_LOOKUPS } from './routeCatalog';

interface RouteLookup {
  path: string;
  method?: string;
}

const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

function parseLookup(value: unknown): RouteLookup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { path, method } = value as Record<string, unknown>;
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    /[\s?#\\]/.test(path) ||
    path.includes('//')
  )
    return null;
  if (method === undefined) return { path };
  if (typeof method !== 'string' || !HTTP_METHODS.has(method.toUpperCase())) {
    return null;
  }
  return { path, method: method.toUpperCase() };
}

export function registerCatalogRoutes(app: Application, port: number): void {
  app.get('/routes', (_req, res) => {
    res.json({
      service: 'Principal MCP Bridge',
      port,
      groups: bridgeRouteCatalog.map(({ name, description, routes }) => ({
        name,
        description,
        routes: routes.map(({ method, path, summary }) => ({
          method,
          path,
          summary,
        })),
      })),
      lookup: {
        method: 'POST',
        path: '/routes',
        maxRoutes: MAX_ROUTE_LOOKUPS,
        body: { routes: [{ path: '/api/topics', method: 'POST' }] },
        note: 'Use exact route patterns from this index, without query strings. Omit method to return every method for a path. Unknown matches are reported per entry.',
      },
    });
  });

  app.post('/routes', (req, res) => {
    const body: unknown = req.body;
    const routes =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).routes
        : undefined;
    if (
      !Array.isArray(routes) ||
      routes.length === 0 ||
      routes.length > MAX_ROUTE_LOOKUPS
    ) {
      res.status(400).json({
        success: false,
        error: `routes must be an array of 1-${MAX_ROUTE_LOOKUPS} { path, method? } entries`,
      });
      return;
    }
    const requests: RouteLookup[] = [];
    for (const [index, value] of routes.entries()) {
      const request = parseLookup(value);
      if (!request) {
        res.status(400).json({
          success: false,
          error: `routes[${index}] must have an absolute route pattern without query strings, fragments, or whitespace, and an optional valid HTTP method`,
        });
        return;
      }
      requests.push(request);
    }
    const results = requests.map((request) => {
      const matches = bridgeRouteCatalog.flatMap((group) =>
        group.routes
          .filter(
            (route) =>
              route.path === request.path &&
              (!request.method || route.method === request.method),
          )
          .map((route) => ({ category: group.name, ...route })),
      );
      return {
        request,
        found: matches.length > 0,
        routes: matches,
        ...(matches.length === 0
          ? {
              error:
                'No documented route matches this path and method. Use patterns from GET /routes.',
            }
          : {}),
      };
    });
    res.json({ success: true, results });
  });
}
