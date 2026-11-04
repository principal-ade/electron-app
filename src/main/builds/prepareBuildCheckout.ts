/**
 * Build checkout preparation.
 *
 * Build configurations describe where their source lives (`checkout`) but the
 * directory may not exist yet: the first run clones it under the builds
 * directory, and later runs bring it up to date according to the config's
 * reset policy. Git is invoked directly (no shell) so a config can never
 * smuggle extra commands through the checkout step.
 *
 * The working tree the run uses is the repo root plus `command.cwd`; only the
 * repo root is cloned/fetched here.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  buildCheckoutCloneUrl,
  type BuildConfiguration,
} from '../../shared/build-configurations/types';

const execFileAsync = promisify(execFile);

/** Runs git with the given arguments, resolving on exit code 0. */
export type GitRunner = (
  args: string[],
  cwd?: string,
) => Promise<{ stdout: string; stderr: string }>;

export interface PrepareBuildCheckoutInput {
  config: BuildConfiguration;
  /** Repo root to clone/fetch into (before `command.cwd`). */
  directory: string;
}

export type CheckoutAction = 'cloned' | 'updated' | 'reused';

export type PrepareBuildCheckoutResult =
  | { ok: true; action: CheckoutAction }
  | { ok: false; error: string };

export interface PrepareBuildCheckoutDeps {
  git?: GitRunner;
  exists?: (path: string) => boolean;
  makeDirectory?: (path: string) => Promise<void>;
}

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

const defaultGit: GitRunner = async (args, cwd) => {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd,
    timeout: 15 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { stdout, stderr };
};

/**
 * Clone or update the build checkout. Never throws for expected failures —
 * a missing remote, a dirty ff-only checkout, or a non-git directory all come
 * back as `{ ok: false, error }` so the caller can refuse to run.
 */
export async function prepareBuildCheckout(
  input: PrepareBuildCheckoutInput,
  deps: PrepareBuildCheckoutDeps = {},
): Promise<PrepareBuildCheckoutResult> {
  const { config, directory } = input;
  const git = deps.git ?? defaultGit;
  const exists = deps.exists ?? existsSync;
  const makeDirectory =
    deps.makeDirectory ??
    (async (path: string) => {
      await mkdir(path, { recursive: true });
    });

  const url = buildCheckoutCloneUrl(config.repo);
  if (!url) {
    return { ok: false, error: `unsupported build repo: ${config.repo}` };
  }
  const { ref, depth, reset } = config.checkout;
  const isGitCheckout = exists(join(directory, '.git'));

  if (!isGitCheckout) {
    if (exists(directory)) {
      return {
        ok: false,
        error: `checkout path exists but is not a git checkout: ${directory}`,
      };
    }
    return cloneCheckout({ git, makeDirectory, directory, url, ref, depth });
  }

  if (reset === 'none') return { ok: true, action: 'reused' };

  try {
    await git(['fetch', '--depth', String(depth), 'origin', ref], directory);
    if (reset === 'clean') {
      await git(['reset', '--hard', 'FETCH_HEAD'], directory);
      // -fd (not -fdx): ignored files such as node_modules survive.
      await git(['clean', '-fd'], directory);
    } else {
      await git(['merge', '--ff-only', 'FETCH_HEAD'], directory);
    }
    return { ok: true, action: 'updated' };
  } catch (error) {
    return { ok: false, error: gitFailure('update', directory, error) };
  }
}

async function cloneCheckout(args: {
  git: GitRunner;
  makeDirectory: (path: string) => Promise<void>;
  directory: string;
  url: string;
  ref: string;
  depth: number;
}): Promise<PrepareBuildCheckoutResult> {
  const { git, makeDirectory, directory, url, ref, depth } = args;
  try {
    await makeDirectory(dirname(directory));
    await git([
      'clone',
      '--depth',
      String(depth),
      '--branch',
      ref,
      '--single-branch',
      url,
      directory,
    ]);
    return { ok: true, action: 'cloned' };
  } catch (error) {
    // `--branch` only accepts branches and tags; a commit sha needs a
    // fetch-by-sha instead.
    if (!COMMIT_SHA.test(ref)) {
      return { ok: false, error: gitFailure('clone', directory, error) };
    }
  }

  try {
    await makeDirectory(directory);
    await git(['init', '-q', directory]);
    await git(['remote', 'add', 'origin', url], directory);
    await git(['fetch', '--depth', String(depth), 'origin', ref], directory);
    await git(['checkout', '--detach', 'FETCH_HEAD'], directory);
    return { ok: true, action: 'cloned' };
  } catch (error) {
    return { ok: false, error: gitFailure('clone', directory, error) };
  }
}

function gitFailure(
  stage: 'clone' | 'update',
  directory: string,
  error: unknown,
): string {
  const details =
    error instanceof Error ? error.message : String(error ?? 'unknown error');
  return `git ${stage} failed for ${directory}: ${details}`;
}
