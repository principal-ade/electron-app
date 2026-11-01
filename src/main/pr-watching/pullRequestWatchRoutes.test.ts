/** @jest-environment node */
import type { Application, Request, Response } from 'express';
import { registerPullRequestWatchRoutes } from './pullRequestWatchRoutes';
import type { PullRequestWatcher } from './PullRequestWatcher';

type Handler = (req: Request, res: Response) => void | Promise<void>;

function mount(watcher: Partial<PullRequestWatcher>) {
  const routes = new Map<string, Handler>();
  const app = {
    get: (path: string, handler: Handler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) =>
      routes.set(`POST ${path}`, handler),
    delete: (path: string, handler: Handler) =>
      routes.set(`DELETE ${path}`, handler),
  } as unknown as Application;
  registerPullRequestWatchRoutes(app, watcher as PullRequestWatcher);
  return routes;
}

function route(routes: Map<string, Handler>, key: string): Handler {
  const handler = routes.get(key);
  if (!handler) throw new Error(`Route not mounted: ${key}`);
  return handler;
}

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

const snapshot = { id: 'acme/app#7', title: 'Add watcher' };

describe('pull request watch routes', () => {
  it('lists watched pull requests', () => {
    const routes = mount({ list: () => [snapshot] as never });
    const res = response();
    route(routes, 'GET /api/pull-requests/watch')({} as Request, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      pullRequests: [snapshot],
    });
  });

  it('rejects browser-origin and malformed watch requests', async () => {
    const watch = jest.fn();
    const routes = mount({ watch, list: () => [] });
    const post = route(routes, 'POST /api/pull-requests/watch');

    let res = response();
    await post(
      { headers: { origin: 'http://x' }, body: { pr: 'acme/app#7' } } as never,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);

    res = response();
    await post({ headers: {}, body: { pr: 'nope' } } as never, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(watch).not.toHaveBeenCalled();
  });

  it('returns 201 for a new watch and 200 when already watched', async () => {
    const watch = jest.fn(async () => ({
      success: true,
      pullRequest: snapshot,
    }));
    let watched: unknown[] = [];
    const routes = mount({
      watch: watch as never,
      list: () => watched as never,
    });
    const post = route(routes, 'POST /api/pull-requests/watch');

    let res = response();
    await post(
      {
        headers: {},
        body: { pr: 'https://github.com/acme/app/pull/7' },
      } as never,
      res,
    );
    expect(watch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme/app#7', number: 7 }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      pullRequest: snapshot,
      alreadyWatched: false,
    });

    watched = [snapshot];
    res = response();
    await post({ headers: {}, body: { pr: 'acme/app#7' } } as never, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyWatched: true }),
    );
  });

  it('maps a failed load to 404', async () => {
    const routes = mount({
      watch: (async () => ({ success: false, error: 'nope' })) as never,
      list: () => [],
    });
    const res = response();
    await route(routes, 'POST /api/pull-requests/watch')(
      { headers: {}, body: { pr: 'acme/app#7' } } as never,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('unwatches by owner/repo/number', () => {
    const unwatch = jest.fn(() => ({ success: true }));
    const routes = mount({ unwatch: unwatch as never });
    const del = route(
      routes,
      'DELETE /api/pull-requests/watch/:owner/:repo/:number',
    );

    let res = response();
    del(
      {
        headers: {},
        params: { owner: 'Acme', repo: 'App', number: '7' },
      } as never,
      res,
    );
    expect(unwatch).toHaveBeenCalledWith('acme/app#7');
    expect(res.json).toHaveBeenCalledWith({ success: true });

    res = response();
    del(
      { headers: {}, params: { owner: 'a', repo: 'b', number: 'x' } } as never,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);

    unwatch.mockReturnValue({
      success: false,
      error: 'Unknown watched pull request.',
    } as never);
    res = response();
    del(
      { headers: {}, params: { owner: 'a', repo: 'b', number: '1' } } as never,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
