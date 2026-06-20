/**
 * Shared helpers for the clone-path convention: local clones should live at
 * `{baseDir}/{owner}/{repo}`.
 *
 * These are pure string utilities with no dependency on Node's `path` (main)
 * vs `path-browserify` (renderer), so the same module is safe to import from
 * either side. Path math uses POSIX-style forward slashes, matching the
 * hand-rolled `joinPath` helpers already scattered through the renderer
 * modals.
 */
import { parsePurl } from '@principal-ai/alexandria-core-library';
import { parseGitHubUrl } from './githubUrlParser';

/** Minimal shape needed to derive an owner — a structural subset of AlexandriaEntry. */
export interface RepoOwnerFields {
  github?: { owner?: string | null } | null;
  /** Canonical PURL (`pkg:github/owner/name`). */
  purl?: string | null;
  /** Git remote URL. */
  remoteUrl?: string | null;
}

export interface ConventionStatus {
  /** True when the repo path lives somewhere beneath `baseDir`. */
  isUnderBaseDir: boolean;
  /** True when the repo path is exactly `{baseDir}/{owner}/{repo}`. */
  isCanonical: boolean;
  /** The canonical location this repo *should* occupy. */
  expectedPath: string;
}

/** Strip a trailing slash (but never reduce a lone "/" to ""). */
function stripTrailingSlash(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Last path segment, tolerant of both `/` and `\` separators. */
export function baseName(p: string): string {
  const segments = stripTrailingSlash(p).split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

/**
 * Join a base directory + optional owner + repo into a clone path. Empty /
 * nullish segments are dropped, so `joinClonePath(base, null, repo)` yields
 * `{base}/{repo}`. The first segment keeps a leading slash (absolute paths);
 * interior segments are trimmed of surrounding slashes.
 */
export function joinClonePath(
  ...parts: Array<string | null | undefined>
): string {
  const clean = parts.filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );
  return clean
    .map((part, i) =>
      i === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, ''),
    )
    .join('/');
}

/**
 * Derive the *known* owner for a repo, preferring the most authoritative
 * source: explicit GitHub metadata, then the canonical PURL namespace, then a
 * parse of the git remote URL. Returns `null` when no real owner can be
 * established — callers that want a fallback (e.g. the signed-in user's login)
 * apply it themselves; detection deliberately does NOT guess.
 */
export function deriveKnownOwner(repo: RepoOwnerFields): string | null {
  const ghOwner = repo.github?.owner?.trim();
  if (ghOwner) return ghOwner;

  if (repo.purl) {
    const parsed = parsePurl(repo.purl);
    if (parsed?.namespace?.trim()) return parsed.namespace.trim();
  }

  if (repo.remoteUrl) {
    const parsed = parseGitHubUrl(repo.remoteUrl);
    if (parsed?.owner?.trim()) return parsed.owner.trim();
  }

  return null;
}

/**
 * Compare two filesystem paths for equality. Case-insensitive, because the
 * desktop app's primary targets (macOS, Windows) are case-insensitive
 * filesystems — folding avoids flagging `{base}/Owner/repo` as off-convention
 * when the derived owner is `owner`.
 */
function pathsEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isUnder(child: string, parent: string): boolean {
  return child.toLowerCase().startsWith(stripTrailingSlash(parent).toLowerCase() + '/');
}

/**
 * Evaluate a cloned repo against the `{baseDir}/{owner}/{repo}` convention.
 * The repo folder name is preserved from the current path (`baseName`), so a
 * relocate moves a repo into the right owner folder without renaming it.
 */
export function getConventionStatus(
  repoPath: string,
  baseDir: string,
  owner: string,
): ConventionStatus {
  const normRepo = stripTrailingSlash(repoPath);
  const normBase = stripTrailingSlash(baseDir);
  const expectedPath = joinClonePath(normBase, owner, baseName(normRepo));

  return {
    isUnderBaseDir: isUnder(normRepo, normBase),
    isCanonical: pathsEqual(normRepo, expectedPath),
    expectedPath,
  };
}

/**
 * The detection predicate for the Projects panel: a cloned repo is flagged as
 * off-convention only when it lives UNDER the base dir at the wrong depth AND a
 * known owner is derivable. Repos outside the base dir, or with no derivable
 * owner, return `null` (no flag). When flagged, returns the target path.
 */
export function getOffConventionTarget(
  repo: RepoOwnerFields & { path: string },
  baseDir: string | null | undefined,
): { expectedPath: string; owner: string } | null {
  if (!baseDir?.trim()) return null;

  const owner = deriveKnownOwner(repo);
  if (!owner) return null;

  const status = getConventionStatus(repo.path, baseDir, owner);
  if (!status.isUnderBaseDir || status.isCanonical) return null;

  return { expectedPath: status.expectedPath, owner };
}
