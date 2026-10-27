/**
 * Resolve the identifiers an agent is likely to have — a repo PURL, an
 * `owner/repo` slug, or a clone URL — into the URL git should clone plus the
 * owner/name pair the clone-path convention (`<base>/<owner>/<repo>`) needs.
 *
 * Kept pure and dependency-free so it can be unit tested without Electron.
 */
import { parsePurl } from '@principal-ai/alexandria-core-library';

export interface CloneTarget {
  /** Host the repo lives on, e.g. `github.com`. */
  host: string;
  owner: string;
  repo: string;
  /** URL handed to `git clone`. */
  cloneUrl: string;
}

export type CloneTargetResult =
  | { ok: true; target: CloneTarget }
  | { ok: false; error: string };

/** PURL types that name a clonable host. */
const PURL_HOSTS: Record<string, string> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
};

/**
 * One path segment of a remote repo. Deliberately strict: the values end up in
 * the clone destination, so anything that could escape the base directory
 * (`..`, nested slashes, absolute paths) has to be rejected here.
 */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

function isSegment(value: string | undefined): value is string {
  return !!value && SEGMENT.test(value) && !value.includes('..');
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/, '');
}

function httpsCloneUrl(host: string, owner: string, repo: string): string {
  return `https://${host}/${owner}/${repo}.git`;
}

function fail(error: string): CloneTargetResult {
  return { ok: false, error };
}

/**
 * Accepts:
 * - repo PURLs — `pkg:github/owner/repo`, `pkg:gitlab/group/sub/repo` (first
 *   path segment is the namespace, matching the PURL spec's single namespace)
 * - slugs — `owner/repo`
 * - clone URLs — `https://host/owner/repo(.git)`, `ssh://git@host/owner/repo`,
 *   `git@host:owner/repo.git`
 *
 * Rejects local-only PURLs (`pkg:generic/local/...`) and filesystem paths:
 * those are already on disk, so cloning them is a caller mistake rather than
 * something to resolve silently.
 */
export function parseCloneTarget(input: string): CloneTargetResult {
  const raw = (input ?? '').trim().replace(/\/+$/, '');
  if (!raw) return fail('empty repo identifier');

  if (raw.startsWith('pkg:')) {
    const parsed = parsePurl(raw);
    if (!parsed) return fail(`not a valid PURL: ${input}`);

    const host = PURL_HOSTS[parsed.type];
    if (!host) {
      return fail(
        `cannot clone a ${parsed.type} PURL (${input}) — pass a github/gitlab/bitbucket PURL, an owner/repo slug, or a clone URL`,
      );
    }
    if (!parsed.namespace) {
      return fail(`PURL is missing an owner namespace: ${input}`);
    }
    const repo = stripGitSuffix(parsed.name);
    if (!isSegment(parsed.namespace) || !isSegment(repo)) {
      return fail(`PURL has an invalid owner or repo name: ${input}`);
    }
    return {
      ok: true,
      target: {
        host,
        owner: parsed.namespace,
        repo,
        cloneUrl: httpsCloneUrl(host, parsed.namespace, repo),
      },
    };
  }

  // Explicit URL: https://, http://, ssh://, git://
  if (/^(?:https?|ssh|git):\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fail(`not a valid URL: ${input}`);
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const owner = segments[0];
    const repo = stripGitSuffix(segments[1] ?? '');
    if (!isSegment(owner) || !isSegment(repo)) {
      return fail(
        `URL does not look like a repo clone URL (expected /<owner>/<repo>): ${input}`,
      );
    }
    return {
      ok: true,
      target: {
        host: url.hostname,
        owner,
        repo,
        cloneUrl: `${url.protocol}//${url.host}/${owner}/${repo}.git`,
      },
    };
  }

  // scp-style SSH: git@github.com:owner/repo.git
  const scp = raw.match(/^(?:[^@/\s]+@)?([^:/\s]+):([^/\s]+)\/([^/\s]+)$/);
  if (scp) {
    const [, host, owner, repoWithSuffix] = scp;
    const repo = stripGitSuffix(repoWithSuffix);
    if (!isSegment(owner) || !isSegment(repo)) {
      return fail(`invalid owner or repo name in SSH URL: ${input}`);
    }
    return {
      ok: true,
      target: { host, owner, repo, cloneUrl: `git@${host}:${owner}/${repo}.git` },
    };
  }

  // Bare owner/repo slug — assume GitHub, the only host we can infer safely.
  const slug = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slug) {
    const owner = slug[1];
    const repo = stripGitSuffix(slug[2]);
    if (!isSegment(owner) || !isSegment(repo)) {
      return fail(`invalid owner or repo name: ${input}`);
    }
    return {
      ok: true,
      target: {
        host: 'github.com',
        owner,
        repo,
        cloneUrl: httpsCloneUrl('github.com', owner, repo),
      },
    };
  }

  return fail(
    `unsupported repo identifier (${input}) — use a github/gitlab/bitbucket PURL, an owner/repo slug, or a clone URL. Filesystem paths are already local; register them with POST /api/repos instead`,
  );
}
