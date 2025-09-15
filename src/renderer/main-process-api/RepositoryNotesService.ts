import { RepositoryNote, StoreNoteRequest, StoreNoteResponse, GetNotesForPathResponse } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';

export class RepositoryNotesService {
  static getNotesForRepository(remoteUrl: string): Promise<RepositoryNote[]> {
    return window.mainProcess.repositoryNotes.getNotesForRepository(remoteUrl);
  }

  static getNotesForPath(path: string, includeParentNotes: boolean = true): Promise<GetNotesForPathResponse> {
    return window.mainProcess.repositoryNotes.getNotesForPath(path, includeParentNotes);
  }

  static storeNote(request: StoreNoteRequest): Promise<StoreNoteResponse> {
    return window.mainProcess.repositoryNotes.storeNote(request);
  }

  static deleteNote(remoteUrl: string, noteId: string): Promise<boolean> {
    return window.mainProcess.repositoryNotes.deleteNote(remoteUrl, noteId);
  }

  static updateNote(remoteUrl: string, noteId: string, updates: Partial<Pick<RepositoryNote, 'note' | 'metadata'>>): Promise<boolean> {
    return window.mainProcess.repositoryNotes.updateNote(remoteUrl, noteId, updates);
  }
}

