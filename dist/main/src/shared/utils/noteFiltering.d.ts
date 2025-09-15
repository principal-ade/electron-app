import { RepositoryNote } from '../main-process-api-interfaces/RepositoryNotesAPI';
export interface FilteredNote extends RepositoryNote {
    isParentDirectory?: boolean;
    pathDistance?: number;
    relevance?: 'exact' | 'parent' | 'related' | 'none';
}
/**
 * Calculate the relevance of a note to a given path
 */
export declare function calculateNoteRelevance(note: RepositoryNote, targetRelativePath: string, includeParentNotes?: boolean): {
    isRelevant: boolean;
    isParentDirectory: boolean;
    pathDistance: number;
};
/**
 * Filter notes by a single path
 */
export declare function filterNotesByPath(notes: RepositoryNote[], targetRelativePath: string, includeParentNotes?: boolean): FilteredNote[];
/**
 * Filter notes by multiple paths (e.g., from a session)
 */
export declare function filterNotesByPaths(notes: RepositoryNote[], targetPaths: string[], includeParentNotes?: boolean): FilteredNote[];
/**
 * Sort filtered notes by relevance
 */
export declare function sortNotesByRelevance(notes: FilteredNote[]): FilteredNote[];
/**
 * Calculate coverage statistics for filtered notes
 */
export declare function calculateNoteCoverage(filteredNotes: FilteredNote[], totalNotes: RepositoryNote[], sessionFilePaths?: string[]): {
    totalNotes: number;
    relevantNotes: number;
    exactMatches: number;
    parentMatches: number;
    coveragePercent: number;
    filesCovered?: number;
    totalFiles?: number;
};
/**
 * Filter notes by session activity
 */
export declare function filterNotesBySession(notes: RepositoryNote[], sessionFilePaths: string[], includeParentNotes?: boolean): {
    filteredNotes: FilteredNote[];
    coverage: ReturnType<typeof calculateNoteCoverage>;
};
//# sourceMappingURL=noteFiltering.d.ts.map