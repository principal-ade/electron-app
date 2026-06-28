/**
 * Express route for cross-repo blast-radius queries, mounted on the Principal
 * MCP Bridge. Lets a briefed agent ask "if I change repo X, which other cloned
 * repos depend on a package it publishes?" — Phase 1 returns DIRECT dependents.
 */

import path from 'path';
import type { Application, Request, Response } from 'express';
import type {
  DependencyGraphService,
  BlastRadiusSelector,
} from './DependencyGraphService';

export function registerDependencyRoutes(
  app: Application,
  service: DependencyGraphService,
): void {
  // GET /api/repos/blast-radius?repo=<owner/name> | ?path=<abs> | ?purl=<purl>
  //   &includeSelf=true   — keep packages published by the target's own repo
  //   &refresh=true       — rebuild the index before answering
  // Phase 1: DIRECT dependents only — the cloned repos whose packages declare a
  // dependency on a package the target repo publishes. Transitive dependents
  // are not yet walked.
  app.get('/api/repos/blast-radius', async (req: Request, res: Response) => {
    const selector = readSelector(req);
    if (!selector) {
      res.status(400).json({
        success: false,
        error:
          'one selector is required: ?repo=<owner/name> | ?path=<abs> | ?purl=<purl>',
      });
      return;
    }
    if (selector.kind === 'path' && !path.isAbsolute(selector.value)) {
      res
        .status(400)
        .json({ success: false, error: '?path must be an absolute path' });
      return;
    }

    const includeSelf = req.query.includeSelf === 'true';
    const forceRebuild = req.query.refresh === 'true';

    try {
      const result = await service.blastRadius(selector, {
        includeSelf,
        forceRebuild,
      });
      if (!result) {
        res.status(404).json({
          success: false,
          error: `no analyzed repository matched ${selector.kind}=${selector.value}`,
        });
        return;
      }
      res.json({ success: true, scope: 'direct-dependents', ...result });
    } catch (err) {
      console.error('[dependencyRoutes] blast-radius failed', err);
      res.status(500).json({
        success: false,
        error: `failed to compute blast radius: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

function readSelector(req: Request): BlastRadiusSelector | null {
  const pick = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const p = pick(req.query.path);
  if (p) return { kind: 'path', value: p };
  const purl = pick(req.query.purl);
  if (purl) return { kind: 'purl', value: purl };
  const repo = pick(req.query.repo);
  if (repo) return { kind: 'repo', value: repo };
  return null;
}
