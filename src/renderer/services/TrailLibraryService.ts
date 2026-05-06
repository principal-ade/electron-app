/**
 * Renderer service for the saved-trail library backing the dev-workspace
 * "Trails" sidebar panel. Sole owner of `window.mainProcess.fileCityTrail`
 * calls related to listing, loading, activating, and deleting saved trails.
 *
 * Parallel to `SequenceDiagramLibraryService`.
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

  static async activate(id: string): Promise<void> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return;
    try {
      await api.activate(id);
    } catch (err) {
      console.error('[TrailLibraryService] activate failed', err);
    }
  }

  static async remove(id: string): Promise<void> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return;
    try {
      await api.delete(id);
    } catch (err) {
      console.error('[TrailLibraryService] remove failed', err);
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
