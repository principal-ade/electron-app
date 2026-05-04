/**
 * Renderer service for note CRUD on a File City sequence-diagram payload.
 * Wraps `window.mainProcess.fileCitySequence` so components/hooks never touch
 * the preload surface directly.
 *
 * Notes live on the payload (`payload.notes`); mutations re-broadcast
 * `PAYLOAD_SET` so subscribers via `SequenceDiagramService` pick them up.
 */

import type {
  SequenceNote,
  SequenceNoteDraft,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

export class SequenceNotesService {
  static async create(
    payloadId: string,
    draft: SequenceNoteDraft,
  ): Promise<SequenceNote | null> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return null;
    try {
      return await api.createNote(payloadId, draft);
    } catch (err) {
      console.error('[SequenceNotesService] createNote failed', err);
      return null;
    }
  }

  static async update(
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<SequenceNote | null> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return null;
    try {
      return await api.updateNote(payloadId, noteId, body);
    } catch (err) {
      console.error('[SequenceNotesService] updateNote failed', err);
      return null;
    }
  }

  static async remove(payloadId: string, noteId: string): Promise<void> {
    const api = window.mainProcess?.fileCitySequence;
    if (!api) return;
    try {
      await api.deleteNote(payloadId, noteId);
    } catch (err) {
      console.error('[SequenceNotesService] deleteNote failed', err);
    }
  }
}
