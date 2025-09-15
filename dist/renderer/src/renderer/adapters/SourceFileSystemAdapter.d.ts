import { FileSystemAdapter } from "@principal-ai/codebase-composition";
import { FileTreeSource } from "../types/file-tree-source";
import { ElectronPlatformAdapters } from "./ElectronPlatformAdapters";
import { GitHubWebAdapters } from "./GitHubWebAdapters";
/**
 * A source-aware filesystem adapter that automatically handles path resolution
 * based on the source type (local vs GitHub) and provides a unified interface
 * for reading files from either source.
 */
export declare class SourceFileSystemAdapter implements FileSystemAdapter {
    private source;
    private electronAdapter;
    private githubAdapter;
    constructor(source: FileTreeSource, adapters?: {
        electron?: ElectronPlatformAdapters;
        github?: GitHubWebAdapters;
    });
    /**
     * Read a file, automatically handling path resolution based on source type
     * @param path - Relative path from repo root (e.g., "package.json", "src/index.ts")
     */
    readFile(path: string): Promise<{
        content: string;
    } | null>;
    /**
     * Check if a file exists
     */
    fileExists(path: string): Promise<boolean>;
    /**
     * Read a directory's contents
     */
    readDirectory(path: string): Promise<string[]>;
    /**
     * Check if a path is a directory
     */
    isDirectory(path: string): Promise<boolean>;
    /**
     * Get file statistics
     */
    getFileStats(path: string): Promise<{
        size: number;
        isDirectory: boolean;
        lastModified: Date;
    } | null>;
    /**
     * Resolve a relative path to an absolute path for local sources
     */
    private resolveLocalPath;
    /**
     * Create a simple file reader function for use with PackageLayerModule
     * This returns just the content string, not the wrapper object
     */
    createFileReader(): (path: string) => Promise<string>;
    /**
     * Build filtered file tree - delegates to the appropriate adapter
     */
    buildFilteredFileTree(directoryPath: string, patterns?: string[], sourceDirectory?: string): Promise<{
        paths: string[];
        stats?: Map<string, {
            size: number;
            isDirectory: boolean;
            lastModified: Date;
        }>;
    }>;
}
//# sourceMappingURL=SourceFileSystemAdapter.d.ts.map