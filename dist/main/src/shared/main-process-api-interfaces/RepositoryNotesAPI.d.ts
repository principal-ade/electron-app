import type { GitInfo } from '../types/git.types';
/**
 * Repository note structure
 * Stores notes with associated directory paths and git information
 */
export interface RepositoryNote {
    id: string;
    note: string;
    fullPath: string;
    relativePath: string;
    anchors?: string[];
    tags?: string[];
    confidence?: 'high' | 'medium' | 'low';
    type?: 'decision' | 'pattern' | 'gotcha' | 'explanation';
    gitInfo: GitInfo;
    timestamp: number;
    metadata?: Record<string, unknown>;
    deleted?: boolean;
}
export declare enum RepositoryNotesAPIEvent {
    GET_FOR_REPOSITORY = "repository-notes:get-for-repository",
    GET_FOR_PATH = "repository-notes:get-for-path",
    STORE_NOTE = "repository-notes:store",
    DELETE_NOTE = "repository-notes:delete",
    UPDATE_NOTE = "repository-notes:update"
}
export interface StoreNoteRequest {
    note: string;
    directoryPath: string;
    anchors?: string[];
    tags?: string[];
    confidence?: 'high' | 'medium' | 'low';
    type?: 'decision' | 'pattern' | 'gotcha' | 'explanation';
    metadata?: Record<string, unknown>;
}
export interface StoreNoteResponse {
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
export interface GetNotesForPathResponse {
    notes: Array<RepositoryNote & {
        isParentDirectory?: boolean;
        pathDistance?: number;
    }>;
    repository?: {
        remoteUrl: string;
        owner?: string;
        repo?: string;
    };
}
export interface RepositoryNotesAPI {
    getNotesForRepository: (remoteUrl: string) => Promise<RepositoryNote[]>;
    getNotesForPath: (path: string, includeParentNotes?: boolean) => Promise<GetNotesForPathResponse>;
    storeNote: (request: StoreNoteRequest) => Promise<StoreNoteResponse>;
    deleteNote: (remoteUrl: string, noteId: string) => Promise<boolean>;
    updateNote: (remoteUrl: string, noteId: string, updates: Partial<Pick<RepositoryNote, 'note' | 'metadata'>>) => Promise<boolean>;
}
//# sourceMappingURL=RepositoryNotesAPI.d.ts.map