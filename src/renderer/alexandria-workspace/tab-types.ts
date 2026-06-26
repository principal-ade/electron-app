/**
 * Alexandria window tab union. Mirrors the dev-workspace pattern: terminal
 * tabs (managed internally by `TabbedTerminalPanel`) and content tabs whose
 * lifecycle this window owns.
 *
 * v1 adds a single `FileCityTrailTab` so clicking a row in the trails panel
 * opens the trail explorer in a sibling tab. Extending the union (markdown,
 * skill, etc.) follows the dev-workspace template.
 */

import type { TerminalTab } from '@industry-theme/xterm-terminal-panel';

export interface FileCityTrailTab {
  id: string;
  label: string;
  contentType: 'file-city-trail';
  closable?: boolean;
}

/**
 * Edits the workspace topic's `description` (an in-memory markdown string) in
 * the file-backed `MDXEditorPanel`. `filePath` is a synthetic sentinel
 * (`topic://<id>/description.md`) that the panel's injected file actions route
 * to `TopicService` instead of disk — see `topicDescriptionSentinel.ts`.
 */
export interface TopicDescriptionTab {
  id: string;
  label: string;
  contentType: 'topic-description';
  filePath: string;
  closable?: boolean;
}

/**
 * A documentation file opened from the Alexandria docs panel. Unlike the two
 * singleton tabs above, these are multi-instance — one per distinct file —
 * keyed by absolute `filePath`. Rendered read-only in the same `MarkdownPanel`
 * the right slot uses. `repositoryPath` is carried so the viewer can resolve
 * relative links and notes without depending on the live selected repo.
 */
export interface MarkdownDocTab {
  id: string;
  label: string;
  contentType: 'markdown-doc';
  filePath: string;
  repositoryPath?: string;
  closable?: boolean;
}

/**
 * A non-markdown source file opened from a doc link. Rendered read-only in the
 * same `PierreFileView` the dev-workspace file-city panel uses (it reads the
 * file itself and syntax-highlights it). Multi-instance, keyed by absolute
 * `filePath`. Markdown links use {@link MarkdownDocTab} instead.
 */
export interface SourceFileTab {
  id: string;
  label: string;
  contentType: 'source-file';
  filePath: string;
  closable?: boolean;
}

/**
 * An image/video opened from a doc link. Rendered in the shared
 * `MediaViewerPanel` (served over the `local-media://` protocol). Multi-instance,
 * keyed by absolute `filePath`.
 */
export interface MediaTab {
  id: string;
  label: string;
  contentType: 'media';
  filePath: string;
  closable?: boolean;
}

/**
 * A mermaid diagram opened from an inline diagram's "open in tab" arrow button
 * (rendered by `IndustryMarkdownSlide` via `onOpenMermaidInTab`). Unlike the
 * file-backed tabs above, this carries the diagram source inline — there is no
 * path on disk. Multi-instance, keyed by a hash of `code` so re-clicking the
 * same diagram focuses the existing tab instead of stacking duplicates.
 */
export interface MermaidDiagramTab {
  id: string;
  label: string;
  contentType: 'mermaid-diagram';
  code: string;
  closable?: boolean;
}

/**
 * A topic opened in the workspace — e.g. when the bridge's
 * `POST /api/topics/:id/activate` targets this (focused) window. Unlike
 * {@link TopicDescriptionTab} (which edits the workspace's own bound topic's
 * notes), this hosts an arbitrary topic by id, read-only, in the shared
 * `LocalTopicTabContent`. Multi-instance, keyed by `topicId`.
 */
export interface TopicTab {
  id: string;
  label: string;
  contentType: 'topic';
  topicId: string;
  title?: string;
  closable?: boolean;
}

/**
 * A single trail opened (read-only) from a topic tab's trails rail, rendered
 * with the shared `LocalTrailTabContent`. Distinct from {@link FileCityTrailTab}
 * (the singleton 3D explorer): multi-instance, keyed by `trailId`. Mirrors
 * dev-workspace's `LocalTrailTab`.
 */
export interface LocalTrailTab {
  id: string;
  label: string;
  contentType: 'local-trail';
  trailId: string;
  title?: string;
  closable?: boolean;
}

export type AlexandriaTab =
  | TerminalTab
  | FileCityTrailTab
  | TopicDescriptionTab
  | TopicTab
  | LocalTrailTab
  | MarkdownDocTab
  | SourceFileTab
  | MediaTab
  | MermaidDiagramTab;
