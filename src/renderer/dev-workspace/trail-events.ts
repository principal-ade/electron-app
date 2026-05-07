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
} as const;

export interface TrailActivatedEvent {
  payload: TrailPayload;
  repositoryPath: string | undefined;
}

export interface TrailClearedEvent {
  repositoryPath: string | undefined;
}

export interface TrailLibraryChangedEvent {
  repositoryPath: string | undefined;
}
