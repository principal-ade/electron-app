/**
 * Renderer service for note CRUD on a File City trail payload. Wraps
 * `window.mainProcess.fileCityTrail` so components/hooks never touch the
 * preload surface directly.
 *
 * Notes live on the payload (`payload.notes`); mutations re-broadcast
 * `PAYLOAD_SET` so subscribers via `TrailService` pick them up.
 *
 * Parallel to `SequenceNotesService`.
 */

import type {
  TrailNote,
  TrailNoteDraft,
} from '@industry-theme/file-city-panel';

export class TrailNotesService {
  static async create(
    payloadId: string,
    draft: TrailNoteDraft,
  ): Promise<TrailNote | null> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return null;
    try {
      return await api.createNote(payloadId, draft);
    } catch (err) {
      console.error('[TrailNotesService] createNote failed', err);
      return null;
    }
  }

  static async update(
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<TrailNote | null> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return null;
    try {
      return await api.updateNote(payloadId, noteId, body);
    } catch (err) {
      console.error('[TrailNotesService] updateNote failed', err);
      return null;
    }
  }

  static async remove(payloadId: string, noteId: string): Promise<void> {
    const api = window.mainProcess?.fileCityTrail;
    if (!api) return;
    try {
      await api.deleteNote(payloadId, noteId);
    } catch (err) {
      console.error('[TrailNotesService] deleteNote failed', err);
    }
  }
}
