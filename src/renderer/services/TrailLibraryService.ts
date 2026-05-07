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
  activeId: string | null;
}

export class TrailLibraryService {
  static async list(repositoryPath?: string): Promise<TrailLibraryListing> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return { entries: [], activeId: null };
    try {
      return await api.list(repositoryPath);
    } catch (err) {
      console.error('[TrailLibraryService] list failed', err);
      return { entries: [], activeId: null };
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
   * Returns the activated payload + repositoryPath, or `null` if the id
   * was unknown / the bridge is unavailable. Renderer-initiated activations
   * do not emit IPC `PAYLOAD_SET` — the caller updates state from this
   * return value and emits a renderer event for in-window coordination.
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
   * Returns the deletion outcome so the caller can clear local state when
   * the deleted entry was the active one. Renderer-initiated deletes do
   * not emit IPC `PAYLOAD_CLEARED`.
   */
  static async remove(id: string): Promise<{
    found: boolean;
    wasActive: boolean;
    repositoryPath?: string;
  }> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) {
      return { found: false, wasActive: false, repositoryPath: undefined };
    }
    try {
      return await api.delete(id);
    } catch (err) {
      console.error('[TrailLibraryService] remove failed', err);
      return { found: false, wasActive: false, repositoryPath: undefined };
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
