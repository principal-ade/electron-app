/**
 * Portal tab contract — the tab interfaces shared across the Projects / Inbox /
 * Topics workspace surfaces.
 *
 * `SharedTrailTab`, `LocalTrailTab`, and `MarkdownDocTab` were historically
 * declared 2–3× (once per framework) with identical shapes. They're defined
 * once here so the surfaces — and the future unified `PortalTab` union (see
 * docs/portal-unification.md, Increment 2) — share a single definition. Each
 * framework imports + re-exports these for back-compat with existing importers
 * (the per-view `*TabsContext`s).
 */
import type { BaseTab } from '@industry-theme/xterm-terminal-panel';

/**
 * Shared trail tab — a trail published to web-ade (e.g. opened from an inbox
 * row, a recently-visited row, or a pasted `…/trail/{id}` URL). NOT in the local
 * trail library; carries only the id, and the panel self-fetches the payload
 * (resolving owner/repo).
 */
export interface SharedTrailTab extends BaseTab {
  contentType: 'shared-trail';
  trailId: string;
  owner?: string;
  repo?: string;
}

/**
 * Local trail tab — a trail from the on-disk library, opened in-place (e.g. a
 * freshly authored trail, or one picked from a topic's Trails rail). Carries
 * only the id; the panel self-fetches the payload + repositoryPath.
 */
export interface LocalTrailTab extends BaseTab {
  contentType: 'local-trail';
  trailId: string;
}

/**
 * Markdown document tab — a doc opened in-place from the Principal MCP Bridge
 * (POST /api/document/open). Carries the absolute file path + host repo; renders
 * via `MarkdownDocTabContent`.
 */
export interface MarkdownDocTab extends BaseTab {
  contentType: 'markdown-doc';
  filePath: string;
  repositoryPath?: string;
}
