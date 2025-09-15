/**
 * File system adapter interface for accessing markdown files across platforms
 */
import { FileInfo, FindOptions, FileWatchCallback, Disposable } from './types';
export interface SearchFileSystemAdapter {
    /**
     * Find all markdown files in the workspace
     */
    findMarkdownFiles(options?: FindOptions): Promise<FileInfo[]>;
    /**
     * Read file content as string
     */
    readFile(path: string): Promise<string>;
    /**
     * Watch for file changes (optional - not all platforms support this)
     */
    watchFiles?(pattern: string, callback: FileWatchCallback): Disposable;
    /**
     * Get relative path from workspace root
     */
    getRelativePath(path: string): string;
    /**
     * Get file information
     */
    getFileInfo(path: string): Promise<FileInfo>;
}
//# sourceMappingURL=FileSystemAdapter.d.ts.map