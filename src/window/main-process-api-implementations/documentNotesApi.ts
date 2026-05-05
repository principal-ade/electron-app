import { ipcRenderer } from 'electron';
import type { DocumentNotesAPI } from '../../shared/main-process-api-interfaces/DocumentNotesAPI';
import { DocumentNotesAPIEvent } from '../../shared/main-process-api-interfaces/DocumentNotesAPI';
import type {
  DocumentNote,
  DocumentNoteDraft,
  DocumentNotesFileSummary,
} from '../../shared/types/document-notes.types';

export const documentNotesAPI: DocumentNotesAPI = {
  list: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
  ): Promise<DocumentNote[]> =>
    ipcRenderer.invoke(
      DocumentNotesAPIEvent.LIST,
      repositoryPath,
      relativeFilePath,
    ),

  listLibrary: (
    repositoryPath?: string,
  ): Promise<DocumentNotesFileSummary[]> =>
    ipcRenderer.invoke(DocumentNotesAPIEvent.LIST_LIBRARY, repositoryPath),

  create: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    draft: DocumentNoteDraft,
  ): Promise<DocumentNote> =>
    ipcRenderer.invoke(
      DocumentNotesAPIEvent.CREATE,
      repositoryPath,
      relativeFilePath,
      draft,
    ),

  update: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
    body: string,
  ): Promise<DocumentNote | null> =>
    ipcRenderer.invoke(
      DocumentNotesAPIEvent.UPDATE,
      repositoryPath,
      relativeFilePath,
      noteId,
      body,
    ),

  delete: (
    repositoryPath: string | undefined,
    relativeFilePath: string,
    noteId: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke(
      DocumentNotesAPIEvent.DELETE,
      repositoryPath,
      relativeFilePath,
      noteId,
    ),
};
