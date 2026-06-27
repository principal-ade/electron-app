/**
 * Portal intents — the view-agnostic "open this content" events that flow on a
 * panel event bus from left panels / tab content to the single tab host that
 * turns them into tabs.
 *
 * Part of the portal-unification work (see docs/portal-unification.md): emitters
 * fire these intents instead of calling a view-specific tabs context directly,
 * so one listener can later subsume the per-view tab contexts. The names live in
 * a `const` map (not bare string literals) so a mistyped intent fails to compile
 * rather than silently never matching.
 */
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';

export const PORTAL_INTENTS = {
  /** Open a trail (a shared web-ade trail, or a local on-disk trail) as a tab. */
  trailOpen: 'trail:open',
  /** Open a topic as a tab. */
  topicOpen: 'topic:open',
  /** Open a markdown document as a tab. */
  docOpen: 'doc:open',
} as const;

export type PortalIntentName =
  (typeof PORTAL_INTENTS)[keyof typeof PORTAL_INTENTS];

/** Payload for {@link PORTAL_INTENTS.trailOpen}. */
export interface TrailOpenPayload {
  trailId: string;
  /**
   * `shared` = a web-ade trail (carries owner/repo for its file tree);
   * `local` = a trail from the on-disk library.
   */
  source: 'shared' | 'local';
  owner?: string;
  repo?: string;
  title?: string;
}

/** Payload for {@link PORTAL_INTENTS.topicOpen}. */
export interface TopicOpenPayload {
  topicId: string;
  title?: string;
}

/** Payload for {@link PORTAL_INTENTS.docOpen}. */
export interface DocOpenPayload {
  filePath: string;
  repositoryPath?: string;
}

/** Emit a {@link PORTAL_INTENTS.trailOpen} intent. */
export function emitTrailOpen(
  events: PanelEventEmitter,
  source: string,
  payload: TrailOpenPayload,
): void {
  events.emit<TrailOpenPayload>({
    type: PORTAL_INTENTS.trailOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Emit a {@link PORTAL_INTENTS.topicOpen} intent. */
export function emitTopicOpen(
  events: PanelEventEmitter,
  source: string,
  payload: TopicOpenPayload,
): void {
  events.emit<TopicOpenPayload>({
    type: PORTAL_INTENTS.topicOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}

/** Emit a {@link PORTAL_INTENTS.docOpen} intent. */
export function emitDocOpen(
  events: PanelEventEmitter,
  source: string,
  payload: DocOpenPayload,
): void {
  events.emit<DocOpenPayload>({
    type: PORTAL_INTENTS.docOpen,
    source,
    timestamp: Date.now(),
    payload,
  });
}
