import type { Application, Request, Response } from 'express';
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { MAX_CLONE_BATCH } from '../principal-mcp/routeCatalog';
import {
  inspectRepositoryDiff,
  normalizeDiffOptions,
  type RepositoryDiffOptions,
  type RepositoryDiffResult,
} from './repositoryDiff';
import type { RunGit } from './repositorySync';

export interface RepositoryDiffRouteDependencies {
  runGit?: RunGit;
  inspectRepositoryDiff?: (
    repoPath: string,
    options: RepositoryDiffOptions,
    runGit?: RunGit,
  ) => Promise<RepositoryDiffResult>;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function registerRepositoryDiffRoutes(
  app: Application,
  registry: AlexandriaRegistryService,
  deps: RepositoryDiffRouteDependencies = {},
): void {
  const inspect = deps.inspectRepositoryDiff ?? inspectRepositoryDiff;

  app.post('/api/repos/diffs', async (req: Request, res: Response) => {
    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : {};

    if (
      (body.includeStaged !== undefined && !isBoolean(body.includeStaged)) ||
      (body.includeUnstaged !== undefined &&
        !isBoolean(body.includeUnstaged)) ||
      (body.includeUpstream !== undefined && !isBoolean(body.includeUpstream))
    ) {
      res.status(400).json({
        success: false,
        error:
          'body.includeStaged, body.includeUnstaged, and body.includeUpstream must be booleans when supplied',
      });
      return;
    }
    if (
      (body.contextLines !== undefined &&
        (!Number.isInteger(body.contextLines) ||
          (body.contextLines as number) < 0 ||
          (body.contextLines as number) > 10)) ||
      (body.maxBytes !== undefined &&
        (typeof body.maxBytes !== 'number' ||
          !Number.isFinite(body.maxBytes) ||
          (body.maxBytes as number) < 1024 ||
          (body.maxBytes as number) > 500_000))
    ) {
      res.status(400).json({
        success: false,
        error:
          'body.contextLines must be an integer 0-10 and body.maxBytes must be 1024-500000 when supplied',
      });
      return;
    }

    let requestedPaths: string[] | undefined;
    if (body.paths !== undefined) {
      if (
        !Array.isArray(body.paths) ||
        body.paths.length === 0 ||
        body.paths.length > MAX_CLONE_BATCH ||
        body.paths.some(
          (repoPath) => typeof repoPath !== 'string' || !repoPath.trim(),
        )
      ) {
        res.status(400).json({
          success: false,
          error: `body.paths must be a non-empty array of up to ${MAX_CLONE_BATCH} registered absolute repository paths`,
        });
        return;
      }
      requestedPaths = [
        ...new Set((body.paths as string[]).map((p) => p.trim())),
      ];
    }

    const options = normalizeDiffOptions({
      includeStaged:
        typeof body.includeStaged === 'boolean'
          ? body.includeStaged
          : undefined,
      includeUnstaged:
        typeof body.includeUnstaged === 'boolean'
          ? body.includeUnstaged
          : undefined,
      includeUpstream:
        typeof body.includeUpstream === 'boolean'
          ? body.includeUpstream
          : undefined,
      contextLines:
        typeof body.contextLines === 'number' ? body.contextLines : undefined,
      maxBytes: typeof body.maxBytes === 'number' ? body.maxBytes : undefined,
    });

    try {
      const registered = await registry.getRepositories();
      const byPath = new Map(
        registered.map((entry) => [String(entry.path), entry]),
      );
      if (requestedPaths) {
        const unknown = requestedPaths.filter(
          (repoPath) => !byPath.has(repoPath),
        );
        if (unknown.length > 0) {
          res.status(400).json({
            success: false,
            error: `only registered repository paths can be inspected; unknown: ${unknown.join(', ')}`,
          });
          return;
        }
      }

      const selected = requestedPaths
        ? requestedPaths
            .map((repoPath) => byPath.get(repoPath))
            .filter((entry) => entry !== undefined)
        : registered;
      const results: RepositoryDiffResult[] = [];
      for (const entry of selected) {
        const repoPath = String(entry.path);
        try {
          results.push(await inspect(repoPath, options, deps.runGit));
        } catch (error) {
          results.push({
            path: repoPath,
            clean: false,
            porcelain: [],
            untracked: [],
            staged: [],
            unstaged: [],
            diffs: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      res.json({
        success: true,
        options,
        results,
        summary: {
          requested: results.length,
          clean: results.filter((r) => r.clean && !r.error).length,
          dirty: results.filter((r) => !r.clean && !r.error).length,
          failed: results.filter((r) => r.error).length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `failed to inspect registered repository diffs: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  });
}
