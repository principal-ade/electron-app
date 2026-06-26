/**
 * Renderer-local event channel for trail state changes initiated by user
 * action inside this window. Click-driven mutations (activate, delete)
 * call IPC for the result, then emit one of these events so other
 * components in the same window can react without a round-trip back
 * through main's IPC broadcast.
 *
 * IPC `PAYLOAD_SET` / `PAYLOAD_CLEARED` / `LIBRARY_CHANGED` events are
 * still used, but only for HTTP-initiated changes — pushed by route
 * handlers via `sendToRepoWindows`.
 */

import type { TrailPayload } from '@industry-theme/file-city-panel';

export const TRAIL_EVENT = {
  activated: 'file-city-trail:activated',
  cleared: 'file-city-trail:cleared',
  libraryChanged: 'file-city-trail:library-changed',
  open: 'file-city-trail:open-tab',
} as const;

export interface TrailActivatedEvent {
  payload: TrailPayload;
  repositoryPath: string | undefined;
}

/**
 * Open a single trail as its own tab in the center editor area. Mirrors
 * {@link TopicOpenEvent}: a surface (e.g. a topic tab's trails rail) emits the
 * trail id + title, the panel framework opens or focuses a `local-trail` tab.
 * Distinct from {@link TRAIL_EVENT.activated}, which drives the File City
 * explorer's active-trail highlight rather than opening a tab.
 */
export interface TrailOpenEvent {
  trailId: string;
  title?: string;
}

export interface TrailClearedEvent {
  repositoryPath: string | undefined;
}

export interface TrailLibraryChangedEvent {
  repositoryPath: string | undefined;
}
