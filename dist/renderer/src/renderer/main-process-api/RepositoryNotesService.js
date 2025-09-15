export class RepositoryNotesService {
    static getNotesForRepository(remoteUrl) {
        return window.mainProcess.repositoryNotes.getNotesForRepository(remoteUrl);
    }
    static getNotesForPath(path, includeParentNotes = true) {
        return window.mainProcess.repositoryNotes.getNotesForPath(path, includeParentNotes);
    }
    static storeNote(request) {
        return window.mainProcess.repositoryNotes.storeNote(request);
    }
    static deleteNote(remoteUrl, noteId) {
        return window.mainProcess.repositoryNotes.deleteNote(remoteUrl, noteId);
    }
    static updateNote(remoteUrl, noteId, updates) {
        return window.mainProcess.repositoryNotes.updateNote(remoteUrl, noteId, updates);
    }
}
