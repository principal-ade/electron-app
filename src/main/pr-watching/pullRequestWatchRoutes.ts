/**
 * Bridge routes for the pull request watch list, so an agent that just opened
 * a PR can ask the app to keep the user informed about it.
 */

import type { Application, Request, Response } from 'express';
import type { PullRequestWatcher } from './PullRequestWatcher';
import { parsePullRequestTarget, pullRequestId } from './pullRequestTarget';

function rejectBrowserOrigin(req: Request, res: Response): boolean {
  if (
    req.headers.origin !== undefined ||
    req.headers['sec-fetch-site'] !== undefined
  ) {
    res.status(403).json({
      success: false,
      error: 'browser-origin requests are not allowed',
    });
    return true;
  }
  return false;
}

export function registerPullRequestWatchRoutes(
  app: Application,
  watcher: PullRequestWatcher,
): void {
  app.get('/api/pull-requests/watch', (_req, res) => {
    res.json({ success: true, pullRequests: watcher.list() });
  });

  app.post('/api/pull-requests/watch', async (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;
    const target = parsePullRequestTarget(req.body?.pr);
    if (!target) {
      res.status(400).json({
        success: false,
        error:
          'pr must be a GitHub pull request URL, owner/repo#number, or owner/repo/pull/number',
      });
      return;
    }
    const alreadyWatched = watcher
      .list()
      .some((entry) => entry.id === target.id);
    try {
      const result = await watcher.watch(target);
      if (!result.success) {
        res.status(404).json(result);
        return;
      }
      res
        .status(alreadyWatched ? 200 : 201)
        .json({ ...result, alreadyWatched });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Watch failed.',
      });
    }
  });

  app.delete('/api/pull-requests/watch/:owner/:repo/:number', (req, res) => {
    if (rejectBrowserOrigin(req, res)) return;
    const number = Number(req.params.number);
    if (!Number.isSafeInteger(number) || number <= 0) {
      res
        .status(400)
        .json({ success: false, error: 'number must be a positive integer' });
      return;
    }
    const result = watcher.unwatch(
      pullRequestId(req.params.owner, req.params.repo, number),
    );
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  });
}
