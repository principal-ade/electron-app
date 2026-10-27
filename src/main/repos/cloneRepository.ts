/**
 * Clone primitive for the bridge's repo routes.
 *
 * Mirrors the core of the renderer's clone IPC handler (GitEvents.CLONE_REPOSITORY):
 * create the parent directory first, pass through the environment git needs for
 * HTTPS credential helpers and SSH agents, and run `git clone`. The IPC handler
 * layers user-facing diagnostics on top of this; the bridge only needs the
 * outcome and git's message.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { gitClientFactory } from '../utils/gitClientFactory';

export interface CloneRepositoryOptions {
  /** Shallow clone depth. Omitted = full history. */
  depth?: number;
  /** Kill the clone after this many ms (default 5 minutes). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Env vars git needs for HTTPS credentials and SSH agent forwarding. */
function gitCloneEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of [
    'PATH',
    'HOME',
    'USER',
    'SSH_AUTH_SOCK',
    'SSH_AGENT_PID',
  ]) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return env;
}

/**
 * Clone `url` into `targetPath`. Creates the parent directory (a missing parent
 * surfaces as a bare spawn ENOENT that hides git's real error).
 *
 * Resolves on success; throws the underlying git error on failure so callers
 * can report stderr/exit details.
 */
export async function cloneRepositoryToPath(
  url: string,
  targetPath: string,
  options: CloneRepositoryOptions = {},
): Promise<void> {
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });

  const git = await gitClientFactory.getClient(parentDir);
  const args = ['clone'];
  if (options.depth && options.depth > 0) {
    args.push('--depth', String(Math.floor(options.depth)));
  }
  args.push(url, targetPath);

  await git.raw(args, {
    env: gitCloneEnv(),
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}
