import { FileSystemAdapter } from "@principal-ai/codebase-composition";
/**
 * Electron-specific implementation of FileSystemAdapter that uses IPC to communicate
 * with the main process for file system operations.
 */
export declare class ElectronFileSystemAdapter implements FileSystemAdapter {
    readFile(path: string): Promise<{
        content: string;
    } | null>;
    fileExists(path: string): Promise<boolean>;
    readDirectory(path: string): Promise<string[]>;
    isDirectory(path: string): Promise<boolean>;
    getFileStats(path: string): Promise<{
        size: number;
        isDirectory: boolean;
        lastModified: Date;
    } | null>;
    /**
     * Fast filtered file tree building - delegates to main process via IPC
     * Implements the FileSystemAdapter interface from core
     */
    buildFilteredFileTree(directoryPath: string, patterns?: string[], // These params are from the core interface but we don't use them
    sourceDirectory?: string): Promise<{
        paths: string[];
        stats?: Map<string, {
            size: number;
            isDirectory: boolean;
            lastModified: Date;
        }>;
    }>;
}
//# sourceMappingURL=ElectronFileSystemAdapter.d.ts.map