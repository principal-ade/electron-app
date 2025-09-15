import { FileSystemAdapter } from "@principal-ai/codebase-composition";
export declare class GitHubFileSystemAdapter implements FileSystemAdapter {
    private owner;
    private repo;
    private branch?;
    private treeCache;
    constructor(owner: string, repo: string, branch?: string | undefined);
    readFile(path: string): Promise<{
        content: string;
    } | null>;
    readDirectory(path: string): Promise<string[]>;
    exists(path: string): Promise<boolean>;
    getStats(path: string): Promise<{
        isDirectory: boolean;
        isFile: boolean;
        size?: number;
    } | null>;
    writeFile(_path: string, _content: string): Promise<void>;
    createDirectory(_path: string): Promise<void>;
    deleteFile(_path: string): Promise<void>;
    deleteDirectory(_path: string): Promise<void>;
    copyFile(_source: string, _destination: string): Promise<void>;
    moveFile(_source: string, _destination: string): Promise<void>;
    getFullTree(): Promise<any>;
    fileExists(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    getFileStats(path: string): Promise<{
        size: number;
        isDirectory: boolean;
        lastModified: Date;
    } | null>;
    /**
     * Build filtered file tree from GitHub's tree API
     * NOTE: Currently just returns all files from the tree without filtering.
     * GitHub already only shows committed files, and pattern filtering for UI preferences
     * can be added later if needed.
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
//# sourceMappingURL=GitHubFileSystemAdapter.d.ts.map