/**
 * Service for interacting with a24z memory in the main process
 */
export class A24zService {
    /**
     * Get all notes for a repository path
     */
    static async getAllNotes(repositoryPath) {
        return window.mainProcess.a24z.getAllNotes(repositoryPath);
    }
    /**
     * Get notes for a specific file path
     */
    static async getNotesForPath(filePath, repositoryPath) {
        return window.mainProcess.a24z.getNotesForPath(filePath, repositoryPath);
    }
    /**
     * Check if a repository has a24z directory
     */
    static async hasA24zDirectory(repositoryPath) {
        return window.mainProcess.a24z.hasA24zDirectory(repositoryPath);
    }
    /**
     * Get count of notes in a repository
     */
    static async getNoteCount(repositoryPath) {
        return window.mainProcess.a24z.getNoteCount(repositoryPath);
    }
}
