/**
 * Document Notes API — user-authored notes attached to markdown documents.
 *
 * Notes are keyed by (repositoryPath?, relativeFilePath) and persisted to
 * disk via `DocumentNotesPersistence` in the main process. The same data is
 * exposed over HTTP through the Principal MCP Bridge for agent access.
 */

import type {
  DocumentNote,
  DocumentNoteDraft,
  DocumentNotesFileSummary,
} from '../types/document-notes.types';

export enum DocumentNotesAPIEvent {
  LIST = 'document-notes:list',
  LIST_LIBRARY = 'document-notes:list-library',
  CREATE = 'document-notes:create',
  UPDATE = 'document-notes:update',
  DELETE = 'document-notes:delete',
}

export interface DocumentNotesAPI {
  /**
   * Read all notes for a single document.
   * Returns an empty array if the file has no notes yet.
   */
  list: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
  ) => Promise<DocumentNote[]>;

  /**
   * List every file that has stored notes, optionally filtered by repository.
   */
  listLibrary: (
    repositoryPath?: string,
  ) => Promise<DocumentNotesFileSummary[]>;

  /**
   * Create a note. The store assigns id + timestamps.
   */
  create: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    draft: DocumentNoteDraft,
  ) => Promise<DocumentNote>;

  /**
   * Update a note's body. Returns null if the note id is unknown.
   */
  update: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
    body: string,
  ) => Promise<DocumentNote | null>;

  /**
   * Delete a note. Returns true when removed, false when the id was unknown.
   */
  delete: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
  ) => Promise<boolean>;
}
