/**
 * Renderer service for the active File City trail payload. Wraps
 * `window.mainProcess.fileCityTrail` so components/hooks never touch the
 * preload surface directly.
 *
 * Sibling: `TrailLibraryService` (saved-trail ops), `TrailNotesService`
 * (note CRUD).
 */

import type {
  TrailPayloadSetEnvelope,
  TrailPayloadClearedEnvelope,
  TrailShowInPrincipalEnvelope,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

const noop = () => {};

export class TrailService {
  /**
   * Read the trail id this window was opened with, if any. Set by main
   * when `openDevWorkspaceWindow` is called with `openTrailId` (encoded as
   * `?openTrailId=<id>` inside the `#init/...` hash) or when the principal
   * window is opened via `focusOrCreateMainWindow({ openTrailId })` on cold
   * start (encoded as `#openTrailId=<id>` directly). Used to bootstrap the
   * trail tab + payload on first render, replacing the persisted "active"
   * pointer that used to live in `_index.json`.
   */
  static getOpenTrailId(): string | null {
    const match = window.location.hash.match(/[#?&]openTrailId=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Subscribe to PAYLOAD_SET. The envelope carries both the portable trail
   * payload and the host-private `repositoryPath`, so subscribers can bucket
   * the broadcast by repo without that field leaking into the trail schema.
   */
  static onPayloadSet(
    callback: (envelope: TrailPayloadSetEnvelope) => void,
  ): () => void {
    return window.mainProcess?.fileCityTrail?.onPayloadSet(callback) ?? noop;
  }

  /** Subscribe to PAYLOAD_CLEARED. Returns an unsubscribe function. */
  static onPayloadCleared(
    callback: (envelope: TrailPayloadClearedEnvelope) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCityTrail?.onPayloadCleared(callback) ?? noop
    );
  }

  /**
   * Subscribe to SHOW_IN_PRINCIPAL. Fired when the bridge routes a trail to
   * the principal window on warm start (no dev-workspace for the repo).
   * Subscribers should switch to TrailsView so the trail surfaces in
   * Recents. Returns an unsubscribe function.
   */
  static onShowInPrincipal(
    callback: (envelope: TrailShowInPrincipalEnvelope) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCityTrail?.onShowInPrincipal(callback) ?? noop
    );
  }
}
