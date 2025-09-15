export declare class FileSystemService {
    static getFileStats(filePath: string): Promise<import("../../shared/main-process-api-interfaces/FileSystemAPI").FileStats | null>;
    static readFile(filePath: string): Promise<{
        content: string;
        filePath: string;
    } | null>;
    static readDirectory(filePath: string): Promise<string[]>;
    static writeFile(filePath: string, content: string): Promise<{
        success: boolean;
        filePath: string;
        error?: string;
    } | null>;
    static watchFile(filePath: string): Promise<boolean>;
    static onFileChange(callback: (event: {
        type: string;
        path: string;
        extension?: string;
        stats?: unknown;
        isCurrentFile?: boolean;
    }) => void): () => void;
    static stopWatchingFile(filePath: string): Promise<boolean>;
    static selectFile(): Promise<{
        content: string;
        filePath: string;
    } | null>;
    static selectDirectory(options?: {
        title?: string;
        buttonLabel?: string;
        properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
    }): Promise<{
        filePaths: string[];
        canceled: boolean;
    } | {
        canceled: true;
    } | null>;
    static watchGitRepository(path: string): Promise<boolean>;
    static stopWatchingGit(): Promise<boolean>;
    static onGitStatusChange(callback: (data: {
        repoPath: string;
        changedFiles: {
            path: string;
            status: 'added' | 'modified' | 'deleted' | 'renamed';
            lastModified?: Date;
        }[];
        timestamp: string;
        initial?: boolean;
    }) => void): () => void;
    static getDirectoryStats(dirPath: string): Promise<{
        totalFiles: number;
        totalDirectories: number;
        totalSize: number;
    } | null>;
    static buildFilteredFileTree(directoryPath: string, options?: {
        gitignore?: boolean;
        ignorePatterns?: string[];
        includeStats?: boolean;
    }): Promise<{
        paths: string[];
        stats?: import("../../shared/main-process-api-interfaces/FileSystemAPI").SerializedFileStats[];
    }>;
    static getHomePath(): Promise<string>;
    static getCurrentWorkingDirectory(): Promise<string>;
}
//# sourceMappingURL=FileSystemService.d.ts.map