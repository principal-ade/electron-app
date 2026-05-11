/**
 * Renderer service for the saved-trail library backing the dev-workspace
 * "Trails" sidebar panel. Sole owner of `window.mainProcess.fileCityTrail`
 * calls related to listing, loading, activating, and deleting saved trails.
 */

import type { TrailPayload } from '@industry-theme/file-city-panel';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

const noop = () => {};

export interface TrailLibraryListing {
  entries: TrailIndexEntry[];
}

export class TrailLibraryService {
  static async list(repositoryPath?: string): Promise<TrailLibraryListing> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return { entries: [] };
    try {
      return await api.list(repositoryPath);
    } catch (err) {
      console.error('[TrailLibraryService] list failed', err);
      return { entries: [] };
    }
  }

  static async load(id: string): Promise<TrailPayload | null> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return null;
    try {
      return await api.load(id);
    } catch (err) {
      console.error('[TrailLibraryService] load failed', err);
      return null;
    }
  }

  /**
   * Resolve a saved trail by id and return the payload + its host-private
   * `repositoryPath`. The caller updates its own state from the return
   * value and emits a renderer event for in-window coordination. No
   * persisted state is mutated and no IPC `PAYLOAD_SET` is emitted.
   */
  static async activate(
    id: string,
  ): Promise<{ payload: TrailPayload; repositoryPath?: string } | null> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return null;
    try {
      return await api.activate(id);
    } catch (err) {
      console.error('[TrailLibraryService] activate failed', err);
      return null;
    }
  }

  /**
   * Permanently delete a saved trail. Returns whether the entry was found
   * and the repo path so the calling renderer can clear local state.
   */
  static async remove(id: string): Promise<{
    found: boolean;
    repositoryPath?: string;
  }> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) {
      return { found: false, repositoryPath: undefined };
    }
    try {
      return await api.delete(id);
    } catch (err) {
      console.error('[TrailLibraryService] remove failed', err);
      return { found: false, repositoryPath: undefined };
    }
  }

  /** Returns an unsubscribe function. */
  static onLibraryChanged(
    callback: (info: { repositoryPath?: string }) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCityTrail?.onLibraryChanged(callback) ?? noop
    );
  }
}
