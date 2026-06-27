/**
 * Produces an `onLinkClick` handler for themed-markdown's `DocumentView` /
 * `IndustryMarkdownSlide`. It is the single home for "what happens when a link
 * inside rendered markdown is clicked" so every markdown surface (topic notes,
 * MarkdownPanel, README, ...) can share one behavior.
 *
 * Phase 1 scope:
 *  - external links (`https:`, `mailto:`, ...) open in the OS browser
 *  - in-document `#anchor` links are left to the renderer (scroll), ignored here
 *  - repo-relative links resolve to an absolute path and emit `file:opened`,
 *    which the Alexandria workspace turns into a `markdown-doc` tab.
 *
 * Validation (does the file exist?), PURL enrichment, and the cross-project
 * "Add this project" flow are deliberately out of scope here and land in later
 * phases — this hook opens optimistically and the tab surfaces a load error if
 * the file is missing.
 */

import { useCallback, useState } from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { ShellService } from '../main-process-api/ShellService';
import type { ResolvedDocLink } from './useWorkspaceFileIndex';
import type { PurlResolution } from '../../shared/utils/resolvePurlLink';

/** Schemes handed off to the OS browser rather than resolved as docs. */
const EXTERNAL_SCHEME = /^(https?:|mailto:|tel:|vscode:)/i;

/** A single repo a path could resolve to (the `ambiguous` case). */
export interface DocLinkCandidate {
  filePath: string;
  repositoryPath: string;
  repoName: string;
}

/**
 * A user-facing notice raised when a clicked doc link can't be opened directly.
 * Rendered by `MarkdownLinkNotice`; `null` when there's nothing to show.
 */
export type LinkNotice =
  | { kind: 'missing'; path: string }
  | { kind: 'ambiguous'; path: string; candidates: DocLinkCandidate[] }
  /**
   * A valid purl file-link whose repo isn't cloned locally. We know exactly
   * which repo to offer (`repoPurl`); the file (`path`) is the purl subpath.
   * Remote (clone-less) open isn't built yet, so the notice points the user at
   * adding/cloning the project. See `docs/purl-aware-doc-link-clicking.md`.
   */
  | { kind: 'needs-clone'; path: string; repoPurl: string };

export interface MarkdownLinkHandler {
  /** Pass to `DocumentView` / `IndustryMarkdownSlide` `onLinkClick`. */
  onLinkClick: (href: string, event?: MouseEvent) => void;
  /** Current notice to render, or `null`. */
  notice: LinkNotice | null;
  /** Dismiss the current notice. */
  dismissNotice: () => void;
  /** Open one candidate from an `ambiguous` notice. */
  openCandidate: (candidate: DocLinkCandidate) => void;
}

export interface MarkdownLinkHandlerOptions {
  /** Event bus used to emit `file:opened` so a doc opens as a tab. */
  events: PanelEventEmitter;
  /**
   * Absolute path of the repository the markdown belongs to. Repo-root-relative
   * links (`docs/x.md`, `/docs/x.md`) resolve against this, and it is forwarded
   * as the opened tab's repository context. For topic notes, pass the currently
   * selected repository's path.
   */
  repositoryPath?: string;
  /**
   * Directory that bare / `./`-relative links resolve against. Defaults to
   * `repositoryPath`. For a real on-disk doc (e.g. MarkdownPanel) pass the
   * doc's own directory so sibling links resolve correctly; topic notes have no
   * such directory, so they fall back to the repository root.
   */
  basePath?: string;
  /**
   * Resolver (e.g. from `useWorkspaceFileIndex`) that maps a repo-relative path
   * to a concrete repo + absolute path via file-tree membership. When provided
   * it takes precedence — this is how topic notes resolve links across the
   * workspace's member repos. A `no-index` result falls back to the
   * `basePath`/`repositoryPath` join below so the handler degrades gracefully
   * while trees are still loading.
   */
  resolve?: (rawPath: string) => ResolvedDocLink;
  /**
   * Resolver for purl-qualified links (`pkg:type/owner/repo#path`), e.g. from
   * `useRepoPurlResolver`. Purls are handled *before* the bare-path logic below
   * — the `#subpath` is the file, so it must be parsed before any `#`-split.
   * Registry-wide and window-independent: the same purl resolves the same way
   * everywhere. Omit it and purl links are simply ignored (back-compat).
   */
  resolvePurl?: (href: string) => PurlResolution;
  /** `source` stamped on the emitted event (for provenance / debugging). */
  source?: string;
}

/**
 * Join `base` + `rel` and collapse `.` / `..` segments. The renderer has no
 * Node `path`, so this is a small POSIX-style normalizer. The result is only
 * ever handed to `readFile` / the tab system, so it is not security-sensitive.
 */
const joinAndNormalize = (base: string, rel: string): string => {
  const parts = base.split('/');
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length > 1) parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
};

export const useMarkdownLinkHandler = ({
  events,
  repositoryPath,
  basePath,
  resolve,
  resolvePurl,
  source = 'markdown-link',
}: MarkdownLinkHandlerOptions): MarkdownLinkHandler => {
  const [notice, setNotice] = useState<LinkNotice | null>(null);

  const open = useCallback(
    (filePath: string, repoPath?: string) => {
      setNotice(null);
      events.emit({
        type: 'file:opened',
        source,
        timestamp: Date.now(),
        payload: { filePath, repositoryPath: repoPath ?? repositoryPath },
      });
    },
    [events, repositoryPath, source],
  );

  const onLinkClick = useCallback(
    (href: string, _event?: MouseEvent) => {
      // themed-markdown passes the href verbatim (confirmed): raw relative/
      // absolute paths, `#fragments` and `..` segments preserved, no encoding.
      if (!href) return;

      // Purl links (`pkg:…#subpath`) must be handled FIRST — before the
      // external-scheme test and, critically, before the `#`-split below, which
      // would otherwise discard the subpath (the actual file). Resolution is
      // registry-wide; a `needs-clone` verdict surfaces the clone affordance.
      if (href.startsWith('pkg:')) {
        if (!resolvePurl) return; // no purl resolver wired → ignore (back-compat)
        const result = resolvePurl(href);
        if (result.status === 'local') {
          open(result.filePath, result.repositoryPath);
          return;
        }
        if (result.status === 'needs-clone') {
          setNotice({
            kind: 'needs-clone',
            path: result.subpath,
            repoPurl: result.repoPurl,
          });
          return;
        }
        // status === 'unresolvable' (malformed / unsafe / bare repo purl).
        setNotice({ kind: 'missing', path: href });
        return;
      }

      // External links → OS browser; never open as a tab.
      if (EXTERNAL_SCHEME.test(href)) {
        void ShellService.openExternal(href);
        return;
      }

      // In-document anchors → let the renderer scroll; nothing to open.
      if (href.startsWith('#')) return;

      // Resolve only the path portion; drop any query/hash suffix.
      const cleanPath = href.split(/[?#]/)[0];
      if (!cleanPath) return;

      // Note: file-type routing (markdown → MarkdownPanel, else → read-only
      // PierreFileView) happens in the `file:opened` listener; the handler just
      // resolves the path and opens it.

      // Preferred path: resolve against the workspace's file-tree index.
      if (resolve) {
        const result = resolve(cleanPath);
        if (result.status === 'resolved') {
          open(result.filePath as string, result.repositoryPath);
          return;
        }
        if (result.status === 'ambiguous') {
          setNotice({
            kind: 'ambiguous',
            path: result.path,
            candidates: result.candidates ?? [],
          });
          return;
        }
        if (result.status === 'missing') {
          setNotice({ kind: 'missing', path: result.path });
          return;
        }
        // status === 'no-index' → fall through to the join fallback below.
      }

      // Fallback: join against an explicit repo/doc-dir context (e.g.
      // MarkdownPanel, or topic notes before the index has loaded).
      const root = basePath ?? repositoryPath;
      if (!root) {
        console.warn(
          '[useMarkdownLinkHandler] no repository context to resolve link:',
          href,
        );
        return;
      }
      const absolutePath = cleanPath.startsWith('/')
        ? joinAndNormalize(repositoryPath ?? root, cleanPath)
        : joinAndNormalize(root, cleanPath);
      open(absolutePath, repositoryPath);
    },
    [resolve, resolvePurl, open, basePath, repositoryPath],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);
  const openCandidate = useCallback(
    (candidate: DocLinkCandidate) =>
      open(candidate.filePath, candidate.repositoryPath),
    [open],
  );

  return { onLinkClick, notice, dismissNotice, openCandidate };
};
