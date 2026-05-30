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

export type AlexandriaTab =
  | TerminalTab
  | FileCityTrailTab
  | TopicDescriptionTab;
