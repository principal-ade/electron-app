/**
 * Renderer service for the saved-payload library backing the dev-workspace
 * "Sequence Diagrams" sidebar panel. Sole owner of `window.mainProcess
 * .fileCitySequence` calls related to listing, loading, activating, and
 * deleting saved entries.
 *
 * Sibling: `SequenceDiagramService` for active-payload ops.
 */

import type {
  SequenceDiagramIndexEntry,
  SequenceDiagramPayload,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const noop = () => {};

export interface SequenceDiagramLibraryListing {
  entries: SequenceDiagramIndexEntry[];
  activeId: string | null;
}

export class SequenceDiagramLibraryService {
  static async list(
    repositoryPath?: string,
  ): Promise<SequenceDiagramLibraryListing> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return { entries: [], activeId: null };
    try {
      return await api.list(repositoryPath);
    } catch (err) {
      console.error('[SequenceDiagramLibraryService] list failed', err);
      return { entries: [], activeId: null };
    }
  }

  static async load(id: string): Promise<SequenceDiagramPayload | null> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return null;
    try {
      return await api.load(id);
    } catch (err) {
      console.error('[SequenceDiagramLibraryService] load failed', err);
      return null;
    }
  }

  static async activate(id: string): Promise<void> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return;
    try {
      await api.activate(id);
    } catch (err) {
      console.error('[SequenceDiagramLibraryService] activate failed', err);
    }
  }

  static async remove(id: string): Promise<void> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return;
    try {
      await api.delete(id);
    } catch (err) {
      console.error('[SequenceDiagramLibraryService] remove failed', err);
    }
  }

  /** Returns an unsubscribe function. */
  static onLibraryChanged(
    callback: (info: { repositoryPath?: string }) => void,
  ): () => void {
    return (
      window.mainProcess?.fileCitySequence?.onLibraryChanged(callback) ?? noop
    );
  }
}
