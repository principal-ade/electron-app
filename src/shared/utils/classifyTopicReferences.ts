/**
 * Classify the references in a topic description against the topic's purl rules.
 * This is the purl-*aware* layer that sits on top of the purl-*agnostic*
 * `extractDocReferences`: it decides which references are problems and which are
 * purl file-refs that still need an existence check.
 *
 * It is pure (no I/O): everything decidable from the text alone is decided here
 * — non-purl repo links, malformed purls, out-of-scope purls, and inline-code
 * that looks like it should be a link. The one thing it cannot decide, whether
 * a file actually *exists* at a ref, is deferred: those refs are returned in
 * `toResolve` for the main-process resolver (layer 3) to check.
 *
 * Lives in electron-app (not markdown-utils) on purpose — purl knowledge stays
 * out of the zero-dep markdown package; only the agnostic extractor is shared.
 */

import { parsePurl, type ParsedPurl } from '@principal-ai/alexandria-core-library';
import { extractDocReferences, type DocReference } from './docReferences';

export type ReferenceSeverity = 'error' | 'finding' | 'suggestion';

export type ReferenceFindingCode =
  /** A link that points into a repo but isn't purl-qualified. */
  | 'non-purl-repo-link'
  /** Href starts with `pkg:` but doesn't parse as a valid purl. */
  | 'malformed-purl'
  /** A purl whose repo isn't one of the topic's repos. */
  | 'out-of-scope'
  /** Inline code that looks like a file path; suggest a purl link. */
  | 'suggest-purl';

export interface ReferenceFinding {
  severity: ReferenceSeverity;
  code: ReferenceFindingCode;
  message: string;
  reference: DocReference;
  /** Repo-root purl (no subpath/version/qualifiers), when the ref names a repo. */
  repoPurl?: string;
  /** File path within the repo (the purl subpath), when present. */
  path?: string;
}

/** A purl file-ref whose existence the resolver (layer 3) must still check. */
export interface ResolvableReference {
  reference: DocReference;
  parsed: ParsedPurl;
  /** Repo-root purl (no subpath/version/qualifiers). */
  repoPurl: string;
  /** File path within the repo (the purl subpath). */
  path: string;
  /** Whether the repo is one of the topic's declared repos. */
  inScope: boolean;
}

export interface TopicReferenceReport {
  findings: ReferenceFinding[];
  toResolve: ResolvableReference[];
}

export interface ClassifyOptions {
  /** The topic's declared repo purls. */
  topicRepoPurls?: string[];
}

/** A URI scheme other than purl (`http:`, `mailto:`, `vscode:`, …). */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Build the repo-root purl (drop version, qualifiers, subpath) from parts. */
export const repoRootPurl = (p: ParsedPurl): string =>
  p.namespace
    ? `pkg:${p.type}/${p.namespace}/${p.name}`
    : `pkg:${p.type}/${p.name}`;

/**
 * Normalize a repo-root purl for membership comparison. Git hosts treat
 * owner/repo case-insensitively, so we lowercase — good enough for v1 (the
 * subpath, which *is* case-sensitive, is compared separately during existence
 * resolution, not here).
 */
export const normalizeRepoPurl = (purl: string): string => {
  const parsed = parsePurl(purl);
  return (parsed ? repoRootPurl(parsed) : purl).toLowerCase();
};

/**
 * Heuristic: does an inline-code span look like a file path worth converting to
 * a purl link? Conservative on purpose — it must contain a `/` *and* end in a
 * filename with an extension. This linkifies `src/foo/bar.ts` while leaving
 * `AuthService.refresh` (no slash), `src/main/auth/` (no file), and `TCP/IP`
 * (no extension) alone.
 */
const looksLikeFilePath = (text: string): boolean => {
  if (/\s/.test(text) || !text.includes('/')) return false;
  const last = text.slice(text.lastIndexOf('/') + 1);
  return /\.[A-Za-z0-9]+$/.test(last);
};

const classifyLink = (
  ref: DocReference,
  scope: Set<string>,
  findings: ReferenceFinding[],
  toResolve: ResolvableReference[],
): void => {
  const href = ref.value;

  // Empty, anchor, or protocol-relative/scheme'd external links: nothing to do.
  if (href === '' || href.startsWith('#')) return;
  if (href.startsWith('//')) return; // protocol-relative → external
  if (!href.startsWith('pkg:') && SCHEME_RE.test(href)) return; // external scheme

  // Purl-qualified link → parse, scope-check, defer existence to the resolver.
  if (href.startsWith('pkg:')) {
    const parsed = parsePurl(href);
    if (!parsed) {
      findings.push({
        severity: 'error',
        code: 'malformed-purl',
        message: `Link "${href}" starts with pkg: but is not a valid purl.`,
        reference: ref,
      });
      return;
    }

    const repoPurl = repoRootPurl(parsed);
    const inScope = scope.size === 0 || scope.has(normalizeRepoPurl(href));

    if (!inScope) {
      findings.push({
        severity: 'finding',
        code: 'out-of-scope',
        message: `Reference into ${repoPurl}, which is not one of the topic's repos.`,
        reference: ref,
        repoPurl,
        path: parsed.subpath,
      });
    }

    // Only file-refs (with a subpath) need an existence check; a bare repo
    // purl references the repo itself and is fine as-is.
    if (parsed.subpath) {
      toResolve.push({
        reference: ref,
        parsed,
        repoPurl,
        path: parsed.subpath,
        inScope,
      });
    }
    return;
  }

  // Anything else is a repo-relative path that should have been purl-qualified.
  findings.push({
    severity: 'error',
    code: 'non-purl-repo-link',
    message: `Link "${href}" points into a repo but isn't purl-qualified; use pkg:<type>/<owner>/<repo>#<path>.`,
    reference: ref,
  });
};

/**
 * Classify every reference in a topic description. Returns synchronous findings
 * plus the purl file-refs that still need an existence check (`toResolve`).
 */
export const classifyTopicReferences = (
  markdown: string,
  opts: ClassifyOptions = {},
): TopicReferenceReport => {
  const scope = new Set(
    (opts.topicRepoPurls ?? []).map((p) => normalizeRepoPurl(p)),
  );

  const findings: ReferenceFinding[] = [];
  const toResolve: ResolvableReference[] = [];

  for (const ref of extractDocReferences(markdown)) {
    if (ref.kind === 'link') {
      classifyLink(ref, scope, findings, toResolve);
    } else if (ref.kind === 'inline-code' && looksLikeFilePath(ref.value)) {
      findings.push({
        severity: 'suggestion',
        code: 'suggest-purl',
        message: `Inline code "${ref.value}" looks like a file path; consider a purl link.`,
        reference: ref,
      });
    }
  }

  return { findings, toResolve };
};
