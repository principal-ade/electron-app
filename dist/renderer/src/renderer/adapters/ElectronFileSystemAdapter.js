import { FileSystemService } from '../main-process-api/FileSystemService';
/**
 * Electron-specific implementation of FileSystemAdapter that uses IPC to communicate
 * with the main process for file system operations.
 */
export class ElectronFileSystemAdapter {
    async readFile(path) {
        try {
            const result = await FileSystemService.readFile(path);
            if (!result)
                return null;
            // The Electron API returns { content, filePath }, we only need content
            return { content: result.content };
        }
        catch (error) {
            console.error('[ElectronFileSystemAdapter] Error reading file:', path, error);
            return null;
        }
    }
    async fileExists(path) {
        try {
            const stats = await FileSystemService.getFileStats(path);
            return stats !== null;
        }
        catch (error) {
            return false;
        }
    }
    async readDirectory(path) {
        try {
            const entries = await FileSystemService.readDirectory(path);
            return entries || [];
        }
        catch (error) {
            console.error('[ElectronFileSystemAdapter] Error reading directory:', path, error);
            return [];
        }
    }
    async isDirectory(path) {
        try {
            const stats = await FileSystemService.getFileStats(path);
            return stats?.isDirectory || false;
        }
        catch (error) {
            console.error('[ElectronFileSystemAdapter] Error getting file stats:', path, error);
            return false;
        }
    }
    // Additional method that the shared FilesystemService might need
    async getFileStats(path) {
        try {
            return await FileSystemService.getFileStats(path);
        }
        catch (error) {
            console.error('[ElectronFileSystemAdapter] Error getting file stats:', path, error);
            return null;
        }
    }
    /**
     * Fast filtered file tree building - delegates to main process via IPC
     * Implements the FileSystemAdapter interface from core
     */
    async buildFilteredFileTree(directoryPath, patterns, // These params are from the core interface but we don't use them
    sourceDirectory) {
        try {
            // Call main process via IPC with globby options
            const result = await FileSystemService.buildFilteredFileTree(directoryPath, {
                gitignore: true, // Always use gitignore
                ignorePatterns: patterns, // Pass patterns if provided
                includeStats: false // We don't need stats during initial tree load
            });
            // Convert stats array to Map if provided
            const stats = result.stats
                ? new Map(result.stats.map(s => [s.path, {
                        size: s.size,
                        isDirectory: s.isDirectory,
                        lastModified: new Date(s.lastModified)
                    }]))
                : undefined;
            return {
                paths: result.paths,
                stats
            };
        }
        catch (error) {
            console.error('[ElectronFileSystemAdapter] Error building file tree:', error);
            return { paths: [] };
        }
    }
}
