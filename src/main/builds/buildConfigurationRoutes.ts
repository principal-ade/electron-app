/**
 * Bridge routes for build configurations (topic-1793592184227).
 *
 * Agents author configs (always as draft — the bridge can never approve),
 * inspect readiness via preflight, ask the app to surface the secret grant
 * UI via request-secrets, and start runs. Run gating lives in
 * startBuildRun, shared with the renderer's Run button.
 */

import type { Application, Request, Response } from 'express';
import {
  BuildConfigurationStore,
  BuildConfigurationValidationError,
} from '../build-configurations/BuildConfigurationStore';
import {
  isAllowedCommandLine,
  isConfirmationCurrent,
  secretStoreRepoId,
} from '../../shared/build-configurations/types';
import {
  startBuildRun,
  type BuildRunDependencies,
  type StartBuildRunCode,
} from './startBuildRun';
import {
  DEFAULT_BUILD_OUTPUT_BYTES,
  MAX_BUILD_OUTPUT_BYTES,
  sanitizeBuildOutput,
  tailBuildOutput,
} from './buildRunOutput';

export interface SecretRequestEvent {
  configId: string;
  configName: string;
  missing: string[];
}

export interface BuildConfigurationRouteDeps {
  store: BuildConfigurationStore;
  /**
   * PURLs of registered local repositories, for the preflight
   * repo-registered check.
   */
  listRepositoryPurls?: () => Promise<string[]>;
  /**
   * Secret env names already granted under a SecretsDomain repoId.
   * Values are never read — keys only.
   */
  getGrantedKeys?: (repoId: string) => Promise<string[]>;
  /**
   * Sink invoked when an agent asks the app to surface the secret grant
   * UI. Absent until the secret-setting surface (P0 item 8) subscribes.
   */
  onSecretsRequested?: (event: SecretRequestEvent) => void;
  /**
   * Run-execution collaborators. Absent, the run endpoints stay at 501;
   * the bridge always wires them.
   */
  runs?: BuildRunDependencies;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fail(res: Response, error: unknown): void {
  console.error('[buildConfigurationRoutes] request failed', error);
  res.status(500).json({ success: false, error: 'request failed' });
}

export function registerBuildConfigurationRoutes(
  app: Application,
  deps: BuildConfigurationRouteDeps,
): void {
  const { store } = deps;

  // List config summaries, most-recent-first.
  app.get('/api/build-configurations', async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, configs: await store.listSummaries() });
    } catch (error) {
      fail(res, error);
    }
  });

  // Create a config. The bridge can never confirm secrets — confirmation
  // happens in the app, so any smuggled confirmation is rejected.
  app.post('/api/build-configurations', async (req: Request, res: Response) => {
    try {
      const body = asObject(req.body);
      if (!body) {
        res
          .status(400)
          .json({ success: false, error: 'body must be an object' });
        return;
      }
      if (body.secretConfirmation !== undefined) {
        res.status(400).json({
          success: false,
          error: 'secrets are confirmed in the app, not via the bridge',
        });
        return;
      }
      const config = await store.create(body);
      res.status(201).json({ success: true, config });
    } catch (error) {
      if (error instanceof BuildConfigurationValidationError) {
        res
          .status(400)
          .json({ success: false, error: error.message, issues: error.issues });
        return;
      }
      fail(res, error);
    }
  });

  // Read a full config.
  app.get(
    '/api/build-configurations/:id',
    async (req: Request, res: Response) => {
      try {
        const config = await store.get(String(req.params.id));
        if (!config) {
          res
            .status(404)
            .json({ success: false, error: 'unknown build configuration id' });
          return;
        }
        res.json({ success: true, config });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  // Patch a config. Material edits clear the secret confirmation in the
  // store; the bridge itself can never confirm secrets.
  app.patch(
    '/api/build-configurations/:id',
    async (req: Request, res: Response) => {
      try {
        const body = asObject(req.body);
        if (!body) {
          res
            .status(400)
            .json({ success: false, error: 'patch must be an object' });
          return;
        }
        if (body.secretConfirmation !== undefined) {
          res.status(400).json({
            success: false,
            error: 'secrets are confirmed in the app, not via the bridge',
          });
          return;
        }
        const config = await store.update(String(req.params.id), body);
        if (!config) {
          res
            .status(404)
            .json({ success: false, error: 'unknown build configuration id' });
          return;
        }
        res.json({ success: true, config });
      } catch (error) {
        if (error instanceof BuildConfigurationValidationError) {
          res.status(400).json({
            success: false,
            error: error.message,
            issues: error.issues,
          });
          return;
        }
        fail(res, error);
      }
    },
  );

  // Delete a config.
  app.delete(
    '/api/build-configurations/:id',
    async (req: Request, res: Response) => {
      try {
        const removed = await store.remove(String(req.params.id));
        if (!removed) {
          res
            .status(404)
            .json({ success: false, error: 'unknown build configuration id' });
          return;
        }
        res.json({ success: true, id: String(req.params.id) });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  // Readiness check: secrets confirmed, granted, repo registered, binary
  // allowlisted.
  app.get(
    '/api/build-configurations/:id/preflight',
    async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        const config = await store.get(id);
        if (!config) {
          res
            .status(404)
            .json({ success: false, error: 'unknown build configuration id' });
          return;
        }
        const granted = new Set(
          (await deps.getGrantedKeys?.(secretStoreRepoId(id))) ?? [],
        );
        const missingSecrets = config.secrets
          .filter((secret) => secret.required && !granted.has(secret.env))
          .map((secret) => secret.env);
        const registered = new Set((await deps.listRepositoryPurls?.()) ?? []);
        const checks = {
          confirmed: isConfirmationCurrent(config),
          missingSecrets,
          repoRegistered: registered.has(config.repo),
          binaryAllowed: isAllowedCommandLine(config.command.line),
        };
        res.json({
          success: true,
          configId: id,
          ready:
            checks.confirmed &&
            checks.missingSecrets.length === 0 &&
            checks.repoRegistered &&
            checks.binaryAllowed,
          checks,
        });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  // Ask the app to surface the secret grant UI. Until the secret-setting
  // surface subscribes, this reports exactly what the user must be told.
  app.post(
    '/api/build-configurations/:id/request-secrets',
    async (req: Request, res: Response) => {
      try {
        const id = String(req.params.id);
        const config = await store.get(id);
        if (!config) {
          res
            .status(404)
            .json({ success: false, error: 'unknown build configuration id' });
          return;
        }
        const granted = new Set(
          (await deps.getGrantedKeys?.(secretStoreRepoId(id))) ?? [],
        );
        const missing = config.secrets
          .filter((secret) => !granted.has(secret.env))
          .map((secret) => secret.env);
        let requested = false;
        if (missing.length > 0 && deps.onSecretsRequested) {
          deps.onSecretsRequested({
            configId: id,
            configName: config.name,
            missing,
          });
          requested = true;
        }
        res.json({ success: true, configId: id, missing, requested });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  // Start a build run in a visible terminal session: the config must be
  // approved, the repo registered, the checkout present, and every required
  // secret granted. Secrets resolve into the spawn environment, never the
  // typed command line.
  app.post(
    '/api/build-configurations/:id/run',
    async (req: Request, res: Response) => {
      try {
        const result = await startBuildRun(
          {
            store,
            listRepositoryPurls: deps.listRepositoryPurls,
            getGrantedKeys: deps.getGrantedKeys,
            runs: deps.runs,
          },
          String(req.params.id),
        );
        if (!result.ok) {
          res.status(httpStatusForRunCode(result.code)).json({
            success: false,
            error: result.error,
            ...(result.code === 'runs-unavailable'
              ? { code: 'build_run_not_implemented' }
              : {}),
            ...(result.missing ? { missing: result.missing } : {}),
          });
          return;
        }
        res.status(201).json({
          success: true,
          runId: result.runId,
          configId: result.configId,
          terminalSessionId: result.terminalSessionId,
          status: result.status,
        });
      } catch (error) {
        fail(res, error);
      }
    },
  );

  // List retained runs, newest first, so callers can discover run IDs before
  // requesting status or sanitized output.
  app.get('/api/build-runs', async (_req: Request, res: Response) => {
    try {
      if (!deps.runs?.listRuns) {
        res.status(501).json({
          success: false,
          error: 'build run listing is not available in this app build',
        });
        return;
      }
      const runs = [...deps.runs.listRuns()].sort((a, b) =>
        b.startedAt.localeCompare(a.startedAt),
      );
      res.json({ success: true, runs });
    } catch (error) {
      fail(res, error);
    }
  });

  app.get('/api/build-runs/:id', async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const record = deps.runs?.getRun(runId) ?? null;
      if (!record) {
        res.status(404).json({
          success: false,
          error: deps.runs
            ? 'unknown build run id'
            : 'build runs are not available yet',
        });
        return;
      }
      res.json({ success: true, run: record });
    } catch (error) {
      fail(res, error);
    }
  });

  // Return a bounded, sanitized output tail for one tracked build run. This
  // intentionally does not expose arbitrary terminal scrollback over HTTP.
  app.get('/api/build-runs/:id/output', async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const run = deps.runs?.getRun(runId) ?? null;
      if (!run) {
        res.status(404).json({ success: false, error: 'unknown build run id' });
        return;
      }
      if (
        !deps.runs?.getOutputBuffer ||
        !deps.runs.getOutputSnapshot ||
        !deps.runs.getSecretEnvNames
      ) {
        res.status(501).json({
          success: false,
          error: 'build output is not available in this app build',
        });
        return;
      }

      const requestedBytes = parseTailBytes(req.query.tailBytes);
      if (requestedBytes === null) {
        res.status(400).json({
          success: false,
          error: `tailBytes must be an integer between 1 and ${MAX_BUILD_OUTPUT_BYTES}`,
        });
        return;
      }

      const secretEnvNames = deps.runs.getSecretEnvNames(runId);
      if (secretEnvNames === null) {
        res.status(409).json({
          success: false,
          error:
            'build secret metadata is unavailable for safe output redaction',
        });
        return;
      }

      const snapshot = deps.runs.getOutputSnapshot(runId);
      if (snapshot === null) {
        res.status(409).json({
          success: false,
          error: 'build terminal output could not be safely snapshotted',
        });
        return;
      }

      let safeOutput: string;
      if (snapshot !== undefined) {
        safeOutput = snapshot;
      } else {
        let secretValues: string[] = [];
        if (secretEnvNames.length > 0) {
          if (!deps.runs.resolveSecrets) {
            res.status(409).json({
              success: false,
              error: 'secret redaction is unavailable; output was not returned',
            });
            return;
          }
          const resolved = await deps.runs.resolveSecrets(
            secretStoreRepoId(run.configId),
            secretEnvNames.map((env) => ({ env, label: env, required: true })),
            { configId: run.configId, runId },
          );
          if (resolved.missing.length > 0) {
            res.status(409).json({
              success: false,
              error:
                'some build secrets are unavailable for safe output redaction',
            });
            return;
          }
          secretValues = Object.values(resolved.env);
        }

        const rawOutput = await deps.runs.getOutputBuffer(runId);
        if (rawOutput === null) {
          res.status(409).json({
            success: false,
            error: 'build terminal output is no longer available',
          });
          return;
        }
        safeOutput = sanitizeBuildOutput(rawOutput, secretValues);
      }

      const tail = tailBuildOutput(safeOutput, requestedBytes);
      res.json({
        success: true,
        runId,
        terminalSessionId: run.terminalSessionId,
        output: tail.output,
        bytesReturned: tail.bytesReturned,
        truncated: tail.truncated,
      });
    } catch (error) {
      fail(res, error);
    }
  });
}

function parseTailBytes(value: unknown): number | null {
  if (value === undefined) return DEFAULT_BUILD_OUTPUT_BYTES;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) &&
    bytes >= 1 &&
    bytes <= MAX_BUILD_OUTPUT_BYTES
    ? bytes
    : null;
}

function httpStatusForRunCode(code: StartBuildRunCode): number {
  switch (code) {
    case 'unknown-config':
      return 404;
    case 'secrets-missing':
    case 'no-window':
      return 409;
    case 'runs-unavailable':
      return 501;
    default:
      return 400;
  }
}
