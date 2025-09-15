import { RepositoryNote, StoreNoteRequest, StoreNoteResponse, GetNotesForPathResponse } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
export declare class RepositoryNotesService {
    static getNotesForRepository(remoteUrl: string): Promise<RepositoryNote[]>;
    static getNotesForPath(path: string, includeParentNotes?: boolean): Promise<GetNotesForPathResponse>;
    static storeNote(request: StoreNoteRequest): Promise<StoreNoteResponse>;
    static deleteNote(remoteUrl: string, noteId: string): Promise<boolean>;
    static updateNote(remoteUrl: string, noteId: string, updates: Partial<Pick<RepositoryNote, 'note' | 'metadata'>>): Promise<boolean>;
}
//# sourceMappingURL=RepositoryNotesService.d.ts.map