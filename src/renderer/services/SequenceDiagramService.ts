/**
 * Renderer service for the active File City sequence-diagram payload.
 * Wraps `window.mainProcess.fileCitySequence` so components/hooks never
 * touch the preload surface directly.
 *
 * Sibling: `SequenceDiagramLibraryService` for library (saved-payload) ops.
 */

import type {
  SequenceDiagramPayload,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const noop = () => {};

export class SequenceDiagramService {
  /** Read the currently-active payload for a repository (or default slot). */
  static async getCurrent(
    repositoryPath?: string,
  ): Promise<SequenceDiagramPayload | null> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return null;
    try {
      return await api.getCurrent(repositoryPath);
    } catch (err) {
      console.error('[SequenceDiagramService] getCurrent failed', err);
      return null;
    }
  }

  /** Subscribe to PAYLOAD_SET. Returns an unsubscribe function. */
  static onPayloadSet(
    callback: (payload: SequenceDiagramPayload) => void,
  ): () => void {
    return window.mainProcess?.fileCitySequence?.onPayloadSet(callback) ?? noop;
  }

  /** Subscribe to PAYLOAD_CLEARED. Returns an unsubscribe function. */
  static onPayloadCleared(
    callback: (info: { repositoryPath?: string }) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCitySequence?.onPayloadCleared(callback) ?? noop
    );
  }
}
