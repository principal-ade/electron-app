/**
 * Build secret resolver (topic-1793592184227, P0 item 4).
 *
 * At run start, translates a config's declared secret *names* into an env
 * map for the PTY spawn environment. Values live only in main-process
 * memory between this call and the spawn — they never cross the bridge,
 * enter a config, or appear in diagnostics. Every non-empty resolution is
 * attributed in a durable names-only audit log.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { UnifiedSecureStorage } from './UnifiedSecureStorage';

export interface BuildSecretDeclaration {
  env: string;
  required: boolean;
}

export interface BuildSecretResolution {
  /** Values for the spawn environment. Hand to the PTY, nowhere else. */
  env: Record<string, string>;
  /** Required names with no usable grant. */
  missing: string[];
}

export interface BuildSecretResolveOptions {
  configId: string;
  runId: string;
}

/** Thrown when a resolution cannot be attributed (fail closed, no secrets). */
export class BuildSecretResolverError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BuildSecretResolverError';
  }
}

export function defaultAuditFile(): string {
  const home =
    process.env.PRINCIPAL_AUDIT_HOME?.trim() ||
    join(homedir(), '.principal', 'audit');
  return join(home, 'build-secret-grants.jsonl');
}

export class BuildSecretResolver {
  constructor(
    private readonly readSecrets: (
      repoId: string,
    ) => Promise<Record<string, unknown> | null> = (repoId) =>
      UnifiedSecureStorage.getInstance().getSecrets(repoId),
    private readonly auditFile: string = defaultAuditFile(),
  ) {}

  /**
   * Resolve declarations against the grants stored under `secretRepoId`
   * (`build:<configId>`). Only non-empty strings become env entries;
   * anything else counts as missing for required names. Diagnostics and
   * the audit record carry names only — never values.
   */
  async resolve(
    secretRepoId: string,
    decls: BuildSecretDeclaration[],
    options: BuildSecretResolveOptions,
  ): Promise<BuildSecretResolution> {
    for (const decl of decls) {
      if (!decl || typeof decl.env !== 'string' || decl.env.length === 0) {
        throw new BuildSecretResolverError(
          'declarations must list non-empty secret env names',
        );
      }
    }
    const stored = (await this.readSecrets(secretRepoId)) ?? {};
    const env: Record<string, string> = {};
    const missing: string[] = [];
    for (const decl of decls) {
      const value = stored[decl.env];
      if (typeof value === 'string' && value.length > 0) {
        env[decl.env] = value;
      } else if (decl.required) {
        missing.push(decl.env);
      }
    }
    const envNames = Object.keys(env);
    if (envNames.length > 0) {
      await this.audit({
        when: new Date().toISOString(),
        configId: options.configId,
        runId: options.runId,
        envNames,
      });
    }
    return { env, missing };
  }

  private async audit(entry: {
    when: string;
    configId: string;
    runId: string;
    envNames: string[];
  }): Promise<void> {
    try {
      await fs.mkdir(dirname(this.auditFile), { recursive: true });
      await fs.appendFile(this.auditFile, `${JSON.stringify(entry)}\n`);
    } catch (error) {
      // Fail closed: an unattributable grant must not be handed out.
      throw new BuildSecretResolverError(
        'could not attribute the secret grant; refusing to resolve',
        error,
      );
    }
  }
}
