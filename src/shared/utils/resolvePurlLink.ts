/**
 * Pure resolver for a purl-qualified doc link (`pkg:github/owner/repo#path`) to
 * a concrete local file, given the Alexandria registry's entries. This is the
 * human-facing, click-time twin of the agent-facing existence check in
 * `src/main/topics/validateTopicLinks.ts` — same purl grammar, same
 * local-clone-by-purl match, but it produces *where to open* rather than *does
 * it exist*.
 *
 * It is intentionally pure (no I/O, no electron/react): the I/O half — loading
 * the registry and keeping it fresh — lives in the `useRepoPurlResolver` hook,
 * which just wraps this. That split keeps the purl logic unit-testable without a
 * renderer or a mocked main process, mirroring `classifyTopicReferences`.
 *
 * Scope (Phase 1): local clone only. A purl whose repo is registered with a
 * local clone resolves to a `local` open; a purl with no matching clone returns
 * `needs-clone` (the caller surfaces a clone / "add this project" affordance).
 * Remote (clone-less) fetch is deliberately out of scope here and lands later —
 * hence the discriminated result, so a `remote` arm can be added without
 * churning callers.
 */

import {
  parsePurl,
  type ParsedPurl,
} from '@principal-ai/alexandria-core-library';
import { repoRootPurl, normalizeRepoPurl } from './classifyTopicReferences';

/** A registry entry as far as purl resolution cares: its purl and clone path. */
export interface PurlResolverRepo {
  /** Canonical PURL identifier; entries without one can't match a purl link. */
  purl?: string;
  /** Local clone root. Absent/empty means "registered but not on disk." */
  path?: string;
  /** Display name, carried through for diagnostics. */
  name?: string;
}

export type PurlResolution =
  /** A registered clone matched: open `filePath` (under `repositoryPath`). */
  | {
      status: 'local';
      repoPurl: string;
      subpath: string;
      filePath: string;
      repositoryPath: string;
    }
  /** Valid purl + file, but no local clone of that repo — offer to clone it. */
  | { status: 'needs-clone'; repoPurl: string; subpath: string }
  /**
   * Can't resolve from the text alone: malformed purl, a path that escapes the
   * repo root, or a bare repo purl with no file subpath. `reason` is for
   * diagnostics; the caller shows a generic "can't open" notice.
   */
  | {
      status: 'unresolvable';
      repoPurl?: string;
      reason: 'malformed-purl' | 'no-subpath' | 'unsafe-path';
    };

/**
 * Normalize a purl subpath to a repo-root-relative path, rejecting anything that
 * escapes the root. The purl spec forbids `.`/`..` segments, so we reject rather
 * than normalize-and-hope — the result is later joined onto a real clone dir.
 */
const safeSubpath = (subpath: string): string | null => {
  if (subpath.startsWith('/')) return null;
  const parts: string[] = [];
  for (const seg of subpath.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return null; // traversal — reject
    parts.push(seg);
  }
  return parts.length > 0 ? parts.join('/') : null;
};

/**
 * Resolve a `pkg:` doc link against the registry. The caller is responsible for
 * having already decided the href is a purl (starts with `pkg:`).
 */
export const resolvePurlLink = (
  href: string,
  repos: PurlResolverRepo[],
): PurlResolution => {
  const parsed: ParsedPurl | null = parsePurl(href);
  if (!parsed) return { status: 'unresolvable', reason: 'malformed-purl' };

  const repoPurl = repoRootPurl(parsed);

  if (!parsed.subpath) {
    // A bare repo purl points at the repo itself, not a file to open.
    return { status: 'unresolvable', repoPurl, reason: 'no-subpath' };
  }
  const subpath = safeSubpath(parsed.subpath);
  if (subpath === null) {
    return { status: 'unresolvable', repoPurl, reason: 'unsafe-path' };
  }

  const target = normalizeRepoPurl(repoPurl);
  const entry = repos.find(
    (e) => e.purl && e.path && normalizeRepoPurl(e.purl) === target,
  );
  if (entry?.path) {
    return {
      status: 'local',
      repoPurl,
      subpath,
      filePath: `${entry.path}/${subpath}`,
      repositoryPath: entry.path,
    };
  }

  return { status: 'needs-clone', repoPurl, subpath };
};
