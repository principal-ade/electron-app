/**
 * Layer 3 + orchestration for topic link validation. The pure layers
 * (`extractDocReferences`, `classifyTopicReferences`) decide everything that's
 * decidable from the text; this is the I/O half that answers the one thing they
 * can't — *does the referenced file actually exist?* — and assembles the final
 * report the `/api/topics/:id/validate-links` route returns.
 *
 * Existence resolution order (decided design):
 *   1. local clone first — if the repo is registered in Alexandria, stat the
 *      file in the working tree (fast, offline, the author's source of truth);
 *   2. remote fallback — when there's no clone, check the GitHub tree of the
 *      pinned ref (if the purl is pinned) or the default branch otherwise.
 * A path that's absent on the (unpinned) default branch gets actionable
 * feedback: anchor the purl to a commit. Remote lookup is GitHub-only; any
 * other host with no clone is reported `repo-unresolvable` rather than guessed.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ParsedPurl } from '@principal-ai/alexandria-core-library';
// Type-only — the concrete classes are dynamically imported in `validateTopicLinks`
// so this module stays importable (electron-free) under jest for unit tests.
import type { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import type { GitHubAdapter } from '../version-control-providers/githubHandlers';
import {
  classifyTopicReferences,
  normalizeRepoPurl,
  type ReferenceFinding,
  type ResolvableReference,
} from '../../shared/utils/classifyTopicReferences';

/** Where a file ref was checked, and the outcome. */
type ResolutionStatus = 'exists' | 'missing' | 'repo-unresolvable';
type ResolutionVia = 'local-clone' | 'remote' | 'none';

interface Resolution {
  status: ResolutionStatus;
  via: ResolutionVia;
  /** `working-tree` for a local clone, else the branch/sha checked remotely. */
  ref?: string;
  detail?: string;
}

/** A single problem, flattened with its position for the route response. */
export interface ValidationFinding {
  severity: ReferenceFinding['severity'];
  code: ReferenceFinding['code'] | 'missing-file' | 'repo-unresolvable';
  message: string;
  line: number;
  column: number;
  /** The link href or the inline-code text the finding is about. */
  target: string;
  repoPurl?: string;
  path?: string;
  /** For existence findings: where it was checked and against which ref. */
  via?: ResolutionVia;
  ref?: string;
}

export interface ValidationReport {
  summary: {
    errors: number;
    findings: number;
    suggestions: number;
    /** purl file-refs whose existence was checked. */
    checked: number;
    /** of those, how many resolved to an existing file. */
    ok: number;
  };
  findings: ValidationFinding[];
}

/** Injectable seams so the orchestrator can be unit-tested without the app. */
export interface ValidateDeps {
  registry: Pick<AlexandriaRegistryService, 'getRepositories'>;
  github: Pick<GitHubAdapter, 'getTree' | 'getRepoDefaultBranch'>;
}

const flatten = (f: ReferenceFinding): ValidationFinding => ({
  severity: f.severity,
  code: f.code,
  message: f.message,
  line: f.reference.line,
  column: f.reference.column,
  target: f.reference.value,
  ...(f.repoPurl ? { repoPurl: f.repoPurl } : {}),
  ...(f.path ? { path: f.path } : {}),
});

/**
 * Normalize a purl subpath into a repo-root-relative path, rejecting anything
 * that escapes the repo root. The purl spec forbids `.`/`..` segments, so we
 * reject rather than normalize-and-hope (defense against path traversal when
 * the path is later joined onto a real clone directory).
 */
const safeRepoPath = (subpath: string): string | null => {
  if (path.posix.isAbsolute(subpath)) return null;
  const norm = path.posix.normalize(subpath);
  if (norm === '..' || norm.startsWith('../') || norm.startsWith('/')) {
    return null;
  }
  return norm;
};

/** Resolve one purl file-ref to an existence verdict. */
const resolveExistence = async (
  ref: ResolvableReference,
  deps: ValidateDeps,
): Promise<Resolution> => {
  const { parsed, repoPurl } = ref;
  const safe = safeRepoPath(ref.path);
  if (safe === null) {
    return { status: 'repo-unresolvable', via: 'none', detail: 'unsafe path' };
  }

  // 1. Local clone first.
  const repos = await deps.registry.getRepositories();
  const target = normalizeRepoPurl(repoPurl);
  const entry = repos.find(
    (e) => e.purl && normalizeRepoPurl(e.purl) === target,
  );
  if (entry?.path) {
    const abs = path.join(String(entry.path), safe);
    try {
      const stat = await fs.stat(abs);
      return {
        status: stat.isFile() ? 'exists' : 'missing',
        via: 'local-clone',
        ref: 'working-tree',
      };
    } catch {
      return { status: 'missing', via: 'local-clone', ref: 'working-tree' };
    }
  }

  // 2. Remote fallback — GitHub only.
  if (parsed.type !== 'github' || !parsed.namespace) {
    return {
      status: 'repo-unresolvable',
      via: 'none',
      detail: `no local clone and ${parsed.type} repos have no remote tree lookup`,
    };
  }
  const owner = parsed.namespace;
  const repo = parsed.name;
  const pinned = pinnedRef(parsed);
  const checkRef =
    pinned ?? (await deps.github.getRepoDefaultBranch(owner, repo)) ?? 'main';
  const tree = await deps.github.getTree(owner, repo, checkRef);
  if (!tree.success) {
    return {
      status: 'repo-unresolvable',
      via: 'remote',
      ref: checkRef,
      detail: tree.error,
    };
  }
  const exists = tree.data.tree.some(
    (t) => t.type === 'blob' && t.path === safe,
  );
  return { status: exists ? 'exists' : 'missing', via: 'remote', ref: checkRef };
};

/** A purl is pinned if it carries a version (`@sha`/`@tag`) or `?commit=`. */
const pinnedRef = (p: ParsedPurl): string | undefined =>
  p.version ?? p.qualifiers?.commit;

const missingMessage = (ref: ResolvableReference, r: Resolution): string => {
  const { path: filePath, repoPurl } = ref;
  if (r.via === 'local-clone') {
    return `${filePath} not found in the local clone of ${repoPurl} (working tree).`;
  }
  if (pinnedRef(ref.parsed)) {
    return `${filePath} not found at pinned ref ${r.ref} of ${repoPurl}.`;
  }
  return `${filePath} not found on ${repoPurl}@${r.ref}. If it exists at a historical commit, anchor the purl to it (@<sha> or ?commit=<sha>).`;
};

/**
 * Validate every file/doc reference in a topic description: classify the
 * references (pure), resolve the purl file-refs' existence (I/O), and return a
 * single report. `topicRepoPurls` scopes the out-of-scope check.
 */
export const validateTopicLinks = async (
  markdown: string,
  opts: { topicRepoPurls?: string[]; deps?: ValidateDeps } = {},
): Promise<ValidationReport> => {
  let deps = opts.deps;
  if (!deps) {
    const [{ AlexandriaRegistryService }, { GitHubAdapter }] = await Promise.all(
      [
        import('../stores/AlexandriaRegistryService'),
        import('../version-control-providers/githubHandlers'),
      ],
    );
    deps = {
      registry: AlexandriaRegistryService.getInstance(),
      github: new GitHubAdapter(),
    };
  }

  const { findings: classFindings, toResolve } = classifyTopicReferences(
    markdown,
    { topicRepoPurls: opts.topicRepoPurls },
  );

  const findings: ValidationFinding[] = classFindings.map(flatten);
  let ok = 0;

  for (const ref of toResolve) {
    const r = await resolveExistence(ref, deps);
    if (r.status === 'exists') {
      ok++;
      continue;
    }
    findings.push({
      severity: 'finding',
      code: r.status === 'missing' ? 'missing-file' : 'repo-unresolvable',
      message:
        r.status === 'missing'
          ? missingMessage(ref, r)
          : `Could not resolve ${ref.repoPurl} to verify ${ref.path}${
              r.detail ? ` (${r.detail})` : ''
            }.`,
      line: ref.reference.line,
      column: ref.reference.column,
      target: ref.reference.value,
      repoPurl: ref.repoPurl,
      path: ref.path,
      via: r.via,
      ...(r.ref ? { ref: r.ref } : {}),
    });
  }

  const summary = {
    errors: findings.filter((f) => f.severity === 'error').length,
    findings: findings.filter((f) => f.severity === 'finding').length,
    suggestions: findings.filter((f) => f.severity === 'suggestion').length,
    checked: toResolve.length,
    ok,
  };

  return { summary, findings };
};
