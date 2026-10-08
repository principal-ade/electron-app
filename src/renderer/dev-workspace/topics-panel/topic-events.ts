/**
 * Renderer-local event channel for topic interactions inside the
 * dev-workspace window. The Topics sidebar panel emits {@link TOPIC_EVENT.open}
 * when a row is clicked; the panel framework listens and opens (or focuses)
 * a topic tab in the center editor area — no round-trip through main.
 *
 * Distinct from the main-process `TopicAPIEvent.TOPIC_ACTIVATE` IPC,
 * which is the cross-window,
 * bridge-initiated path; this one stays in-renderer.
 */

export const TOPIC_EVENT = {
  open: 'topic:open',
} as const;

export interface TopicOpenEvent {
  topicId: string;
  title?: string;
}
