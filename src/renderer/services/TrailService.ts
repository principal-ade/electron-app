/**
 * Renderer service for the active File City trail payload. Wraps
 * `window.mainProcess.fileCityTrail` so components/hooks never touch the
 * preload surface directly.
 *
 * Sibling: `TrailLibraryService` (saved-trail ops), `TrailNotesService`
 * (note CRUD).
 */

import type { TrailPayload } from '@industry-theme/file-city-panel';
import type { TrailPayloadSetEnvelope } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

const noop = () => {};

export class TrailService {
  /** Read the currently-active trail for a repository (or default slot). */
  static async getCurrent(repositoryPath?: string): Promise<TrailPayload | null> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return null;
    try {
      return await api.getCurrent(repositoryPath);
    } catch (err) {
      console.error('[TrailService] getCurrent failed', err);
      return null;
    }
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
    callback: (info: { repositoryPath?: string }) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCityTrail?.onPayloadCleared(callback) ?? noop
    );
  }
}
