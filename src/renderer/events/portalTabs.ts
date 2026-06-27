/**
 * Portal tab contract — the tab interfaces shared across the Projects / Inbox /
 * Topics workspace surfaces.
 *
 * `SharedTrailTab`, `LocalTrailTab`, and `MarkdownDocTab` were historically
 * declared 2–3× (once per framework) with identical shapes. They're defined
 * once here so the surfaces — and the unified `WorkspaceTab` union (see
 * docs/portal-unification.md, Increment 3) — share a single definition.
 *
 * The Inbox/Topics landing + topic tab types (`InboxHomeTab`, `TopicTab`,
 * `TopicsHomeTab`, `LocalTopicTab`) live here too now that the persistent
 * `WorkspaceShell` (not the retired per-view frameworks) renders them.
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

/** Landing tab for the Inbox surface — a hint to pick a trail from the left. */
export interface InboxHomeTab extends BaseTab {
  contentType: 'inbox-home';
}

/**
 * Topic tab — a topic published to web-ade, opened from an inbox row. Carries
 * only the id; `TopicTabContent` self-fetches the topic and its trails.
 */
export interface TopicTab extends BaseTab {
  contentType: 'topic';
  topicId: string;
}

/** Landing tab for the Topics surface — a hint to pick a topic from the left. */
export interface TopicsHomeTab extends BaseTab {
  contentType: 'topics-home';
}

/**
 * Local topic tab — a topic from the on-disk topic store, opened from a left
 * panel row. Carries the id (the body self-fetches) plus the title for the tab
 * label / header.
 */
export interface LocalTopicTab extends BaseTab {
  contentType: 'local-topic';
  topicId: string;
  title?: string;
}
