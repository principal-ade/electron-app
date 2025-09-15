import { ipcMain } from 'electron';
import { RepositoryNotesAPIEvent } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { repositoryNoteHandler } from './repositoryNoteHandler';
export function registerRepositoryNotesHandlers() {
    console.log('[RepositoryNotesHandlers] Registering repository notes IPC handlers');
    // Get notes for a repository - simplified to just use path
    ipcMain.handle(RepositoryNotesAPIEvent.GET_FOR_REPOSITORY, async (_, remoteUrl) => {
        try {
            console.log('[RepositoryNotesHandlers] IPC GET_FOR_REPOSITORY called with:', remoteUrl);
            // For now, return empty array - UI should use GET_FOR_PATH instead
            return [];
        }
        catch (error) {
            console.error('[RepositoryNotesHandlers] Error getting repository notes:', error);
            throw error;
        }
    });
    // Get notes for a specific path
    ipcMain.handle(RepositoryNotesAPIEvent.GET_FOR_PATH, async (_, path, includeParentNotes = true) => {
        try {
            console.log('[RepositoryNotesHandlers] Getting notes for path:', path);
            const result = await repositoryNoteHandler.getNotesForPath(path, includeParentNotes);
            return result;
        }
        catch (error) {
            console.error('[RepositoryNotesHandlers] Error getting notes for path:', error);
            throw error;
        }
    });
    // Store a new note
    ipcMain.handle(RepositoryNotesAPIEvent.STORE_NOTE, async (_, request) => {
        try {
            console.log('[RepositoryNotesHandlers] Storing note for:', request.directoryPath);
            const result = await repositoryNoteHandler.storeNote({
                note: request.note,
                directoryPath: request.directoryPath,
                anchors: request.anchors,
                tags: request.tags,
                confidence: request.confidence,
                type: request.type,
                metadata: request.metadata
            });
            console.log('[RepositoryNotesHandlers] Store result:', result);
            return result;
        }
        catch (error) {
            console.error('[RepositoryNotesHandlers] Error storing note:', error);
            throw error;
        }
    });
    // Delete a note - now requires path instead of remoteUrl
    ipcMain.handle(RepositoryNotesAPIEvent.DELETE_NOTE, async (_, remoteUrl, noteId) => {
        try {
            console.log('[RepositoryNotesHandlers] Deleting note:', noteId);
            // We need a path context for deletion - for now, use process.cwd()
            // In practice, the UI should pass the path context
            const targetPath = process.cwd();
            const result = await repositoryNoteHandler.deleteNote(noteId, targetPath);
            return result;
        }
        catch (error) {
            console.error('[RepositoryNotesHandlers] Error deleting note:', error);
            return false;
        }
    });
    // Update an existing note - now requires path instead of remoteUrl
    ipcMain.handle(RepositoryNotesAPIEvent.UPDATE_NOTE, async (_, remoteUrl, noteId, updates) => {
        try {
            console.log('[RepositoryNotesHandlers] Updating note:', noteId);
            // We need a path context for update - for now, use process.cwd()
            // In practice, the UI should pass the path context
            const targetPath = process.cwd();
            const result = await repositoryNoteHandler.updateNote(noteId, targetPath, updates);
            return result;
        }
        catch (error) {
            console.error('[RepositoryNotesHandlers] Error updating note:', error);
            return false;
        }
    });
}
