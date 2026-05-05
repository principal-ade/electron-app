/**
 * Renderer-side service for document notes.
 *
 * Thin wrapper over `window.mainProcess.documentNotes.*` that matches the
 * static-method service convention used elsewhere in this folder.
 */

import type {
  DocumentNote,
  DocumentNoteDraft,
  DocumentNotesFileSummary,
} from '../../shared/types/document-notes.types';

export class DocumentNotesService {
  static list(
    repositoryPath: string | undefined,
    relativeFilePath: string,
  ): Promise<DocumentNote[]> {
    return window.mainProcess.documentNotes.list(
      repositoryPath,
      relativeFilePath,
    );
  }

  static listLibrary(
    repositoryPath?: string,
  ): Promise<DocumentNotesFileSummary[]> {
    return window.mainProcess.documentNotes.listLibrary(repositoryPath);
  }

  static create(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    draft: DocumentNoteDraft,
  ): Promise<DocumentNote> {
    return window.mainProcess.documentNotes.create(
      repositoryPath,
      relativeFilePath,
      draft,
    );
  }

  static update(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
    body: string,
  ): Promise<DocumentNote | null> {
    return window.mainProcess.documentNotes.update(
      repositoryPath,
      relativeFilePath,
      noteId,
      body,
    );
  }

  static delete(
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
  ): Promise<boolean> {
    return window.mainProcess.documentNotes.delete(
      repositoryPath,
      relativeFilePath,
      noteId,
    );
  }
}
