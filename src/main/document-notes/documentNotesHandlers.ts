/**
 * IPC handler registration for the document-notes API.
 * Renderer-side calls land here and route through the same persistence
 * singleton the HTTP bridge uses, so HTTP and IPC stay consistent.
 */

import { ipcMain } from 'electron';
import { DocumentNotesAPIEvent } from '../../shared/main-process-api-interfaces/DocumentNotesAPI';
import type { DocumentNoteDraft } from '../../shared/types/document-notes.types';
import { GitClientFactory } from '../utils/gitClientFactory';
import { getDocumentNotesPersistence } from './documentNotesPersistence';

/**
 * Resolve a default author string from `git config` user.name/user.email,
 * formatted like a git committer line. Returns undefined when neither is
 * set or the repo path is unavailable; never throws.
 */
async function resolveAuthorFromGitConfig(
  repositoryPath: string | undefined,
): Promise<string | undefined> {
  if (!repositoryPath) return undefined;
  try {
    const [name, email] = await Promise.all([
      GitClientFactory.getConfig(repositoryPath, 'user.name'),
      GitClientFactory.getConfig(repositoryPath, 'user.email'),
    ]);
    if (name && email) return `${name} <${email}>`;
    return name ?? email ?? undefined;
  } catch (err) {
    console.warn('[documentNotesHandlers] git config read failed', err);
    return undefined;
  }
}

export function registerDocumentNotesHandlers(): void {
  const store = getDocumentNotesPersistence();

  ipcMain.handle(
    DocumentNotesAPIEvent.LIST,
    (_event, repositoryPath: string | undefined, relativeFilePath: string) =>
      store.listForFile(repositoryPath, relativeFilePath),
  );

  ipcMain.handle(
    DocumentNotesAPIEvent.LIST_LIBRARY,
    (_event, repositoryPath?: string) => store.listAllFiles(repositoryPath),
  );

  ipcMain.handle(
    DocumentNotesAPIEvent.CREATE,
    async (
      _event,
      repositoryPath: string | undefined,
      relativeFilePath: string,
      draft: DocumentNoteDraft,
    ) => {
      const author =
        draft.author ?? (await resolveAuthorFromGitConfig(repositoryPath));
      return store.createNote(repositoryPath, relativeFilePath, {
        ...draft,
        author,
      });
    },
  );

  ipcMain.handle(
    DocumentNotesAPIEvent.UPDATE,
    (
      _event,
      repositoryPath: string | undefined,
      relativeFilePath: string,
      noteId: string,
      body: string,
    ) => store.updateNote(repositoryPath, relativeFilePath, noteId, body),
  );

  ipcMain.handle(
    DocumentNotesAPIEvent.DELETE,
    (
      _event,
      repositoryPath: string | undefined,
      relativeFilePath: string,
      noteId: string,
    ) => store.deleteNote(repositoryPath, relativeFilePath, noteId),
  );

  console.log('[DocumentNotes] IPC handlers registered');
}
