import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { FilteredNote } from '../../shared/utils/noteFiltering';
interface NoteRequest {
    id?: string;
    note: string;
    directoryPath: string;
    anchors?: string[];
    tags?: string[];
    confidence?: 'high' | 'medium' | 'low';
    type?: 'decision' | 'pattern' | 'gotcha' | 'explanation';
    metadata?: Record<string, any>;
    timestamp?: number;
}
interface NoteResponse {
    success: boolean;
    noteId?: string;
    repository?: {
        remoteUrl: string;
        owner?: string;
        repo?: string;
    };
    relativePath?: string;
    error?: string;
}
declare class RepositoryNoteHandler {
    private gitService;
    private memoryInstances;
    private fs;
    constructor();
    private getMemoryInstance;
    private convertToRepositoryNote;
    storeNote(request: NoteRequest): Promise<NoteResponse>;
    getNotesForRepository(remoteUrl: string): Promise<RepositoryNote[]>;
    getNotesForPath(targetPath: string, includeParentNotes?: boolean): Promise<{
        notes: FilteredNote[];
        repository?: {
            remoteUrl: string;
            owner?: string;
            repo?: string;
        };
    }>;
    deleteNote(noteId: string, targetPath: string): Promise<boolean>;
    updateNote(noteId: string, targetPath: string, updates: Partial<Pick<RepositoryNote, 'note' | 'metadata' | 'tags' | 'confidence' | 'type'>>): Promise<boolean>;
    getAllNotesForPath(targetPath: string): Promise<any[]>;
    getUsedTags(targetPath: string): Promise<string[]>;
    getGuidance(targetPath: string): Promise<string | null>;
}
export declare const repositoryNoteHandler: RepositoryNoteHandler;
export {};
//# sourceMappingURL=repositoryNoteHandler.d.ts.map