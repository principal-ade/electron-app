/**
 * Shared build-run orchestration (used by the bridge run route and the
 * renderer Run button via TIPC).
 *
 * Everything that decides whether a config may run lives here, so the
 * bridge and the UI enforce identical gates: approved, allowlisted,
 * registered repo, present checkout, granted secrets.
 */

import { existsSync } from 'node:fs';
import type { BuildConfigurationStore } from '../build-configurations/BuildConfigurationStore';
import { buildRunCommand, generateRunId } from './BuildRunRegistry';
import type { BuildRunRecord } from '../../shared/build-configurations/types';
import {
  isConfirmationCurrent,
  isAllowedCommandLine,
  resolveBuildCheckoutDir,
  resolveBuildRepoRoot,
  secretStoreRepoId,
  type BuildCheckoutRoots,
  type BuildConfiguration,
  type BuildSecretDecl,
} from '../../shared/build-configurations/types';

export interface ResolvedBuildSecrets {
  env: Record<string, string>;
  missing: string[];
}

export interface BuildSessionInput {
  cwd: string;
  command: string;
  context: string;
  env: Record<string, string>;
}

/** Run-execution collaborators (store-backed in production, fakes in tests). */
export interface BuildRunDependencies {
  resolveSecrets: (
    secretRepoId: string,
    decls: BuildSecretDecl[],
    options: { configId: string; runId: string },
  ) => Promise<ResolvedBuildSecrets>;
  trackRun: (input: {
    runId: string;
    configId: string;
    terminalSessionId: string;
    timeoutMs: number;
  }) => BuildRunRecord;
  getRun: (runId: string) => BuildRunRecord | null;
  createBuildSession: (
    input: BuildSessionInput,
  ) => Promise<{ sessionId: string }>;
  getBuildRoots: () => Promise<BuildCheckoutRoots>;
  /**
   * Clone or update the checkout before the build session starts. Optional:
   * without it the run refuses when the directory is missing (tests and any
   * caller that manages checkouts itself).
   */
  prepareCheckout?: (
    input: PrepareCheckoutInput,
  ) => Promise<PrepareCheckoutResult>;
}

export interface PrepareCheckoutInput {
  config: BuildConfiguration;
  /** Repo root, before `command.cwd` is applied. */
  directory: string;
}

export type PrepareCheckoutResult =
  | { ok: true; action: string }
  | { ok: false; error: string };

export interface StartBuildRunDeps {
  store: Pick<BuildConfigurationStore, 'get'>;
  listRepositoryPurls?: () => Promise<string[]>;
  getGrantedKeys?: (repoId: string) => Promise<string[]>;
  runs?: BuildRunDependencies;
}

export type StartBuildRunCode =
  | 'runs-unavailable'
  | 'unknown-config'
  | 'not-confirmed'
  | 'command-not-allowlisted'
  | 'repo-not-registered'
  | 'no-base-directory'
  | 'checkout-missing'
  | 'checkout-failed'
  | 'secrets-missing'
  | 'no-window'
  | 'failed';

export type StartBuildRunResult =
  | {
      ok: true;
      runId: string;
      configId: string;
      terminalSessionId: string;
      status: BuildRunRecord['status'];
    }
  | { ok: false; code: StartBuildRunCode; error: string; missing?: string[] };

/**
 * Gate a config and, when everything passes, resolve secrets, spawn the
 * wrapped command in a terminal, and track the run. Never throws for
 * expected failures — they come back as `{ ok: false, code }`.
 */
export async function startBuildRun(
  deps: StartBuildRunDeps,
  configId: string,
): Promise<StartBuildRunResult> {
  const fail = (
    code: StartBuildRunCode,
    error: string,
    missing?: string[],
  ): StartBuildRunResult => ({ ok: false, code, error, missing });

  const config = await deps.store.get(configId);
  if (!config) return fail('unknown-config', 'unknown build configuration id');
  if (!deps.runs)
    return fail('runs-unavailable', 'build runs are not available yet');
  if (!isConfirmationCurrent(config)) {
    return fail(
      'not-confirmed',
      'config secrets must be confirmed in the app before it can run',
    );
  }
  if (!isAllowedCommandLine(config.command.line)) {
    return fail(
      'command-not-allowlisted',
      'config command is no longer allowlisted',
    );
  }
  const registered = new Set((await deps.listRepositoryPurls?.()) ?? []);
  if (!registered.has(config.repo)) {
    return fail('repo-not-registered', 'config repo is not registered');
  }
  const buildRoots = await deps.runs.getBuildRoots();
  const repoRoot = resolveBuildRepoRoot({
    checkoutPath: config.checkout.path,
    repo: config.repo,
    buildsDirectory: buildRoots.buildsDirectory,
  });
  const directory = resolveBuildCheckoutDir({
    checkoutPath: config.checkout.path,
    cwd: config.command.cwd,
    repo: config.repo,
    buildsDirectory: buildRoots.buildsDirectory,
  });
  if (!directory || !repoRoot) {
    return fail(
      'no-base-directory',
      'no checkout path set and no builds directory configured; set checkout.path or pick a builds directory in Settings → General',
    );
  }
  if (!deps.runs.prepareCheckout && !existsSync(directory)) {
    return fail(
      'checkout-missing',
      `checkout is not present on disk: ${directory}`,
    );
  }
  const granted = new Set(
    (await deps.getGrantedKeys?.(secretStoreRepoId(configId))) ?? [],
  );
  const missing = config.secrets
    .filter((secret) => secret.required && !granted.has(secret.env))
    .map((secret) => secret.env);
  if (missing.length > 0) {
    return fail('secrets-missing', 'required secrets are not granted', missing);
  }

  const runId = generateRunId();
  // Storage failures propagate: the bridge maps them to 500.
  const resolved = await deps.runs.resolveSecrets(
    secretStoreRepoId(configId),
    config.secrets,
    { configId, runId },
  );
  const stillMissing = resolved.missing.filter((name) =>
    config.secrets.some((secret) => secret.required && secret.env === name),
  );
  if (stillMissing.length > 0) {
    return fail(
      'secrets-missing',
      'required secrets are not granted',
      stillMissing,
    );
  }
  const env = resolved.env;

  // Checkouts live outside the secrets path: clone/update only after the
  // cheap gates pass, so a misconfigured run fails fast.
  if (deps.runs.prepareCheckout) {
    const prepared = await deps.runs.prepareCheckout({
      config,
      directory: repoRoot,
    });
    if (!prepared.ok) {
      return fail('checkout-failed', prepared.error);
    }
    if (!existsSync(directory)) {
      return fail(
        'checkout-failed',
        `checkout has no working directory: ${directory}`,
      );
    }
  }

  let sessionId: string;
  try {
    const session = await deps.runs.createBuildSession({
      cwd: directory,
      command: buildRunCommand(config.command.line, runId),
      context: `build:${configId}`,
      env,
    });
    sessionId = session.sessionId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no live|no window/i.test(message)) {
      return fail(
        'no-window',
        'no live application window to own the terminal',
      );
    }
    return fail('failed', message);
  }

  const record = deps.runs.trackRun({
    runId,
    configId,
    terminalSessionId: sessionId,
    timeoutMs: config.command.timeoutMs,
  });
  return {
    ok: true,
    runId: record.runId,
    configId,
    terminalSessionId: sessionId,
    status: record.status,
  };
}
