/**
 * Service for interacting with a24z memory in the main process
 */
export declare class A24zService {
    /**
     * Get all notes for a repository path
     */
    static getAllNotes(repositoryPath: string): Promise<import("../../shared/main-process-api-interfaces/A24zAPI").A24zNote[]>;
    /**
     * Get notes for a specific file path
     */
    static getNotesForPath(filePath: string, repositoryPath: string): Promise<import("../../shared/main-process-api-interfaces/A24zAPI").A24zNote[]>;
    /**
     * Check if a repository has a24z directory
     */
    static hasA24zDirectory(repositoryPath: string): Promise<boolean>;
    /**
     * Get count of notes in a repository
     */
    static getNoteCount(repositoryPath: string): Promise<number>;
}
//# sourceMappingURL=A24zService.d.ts.map