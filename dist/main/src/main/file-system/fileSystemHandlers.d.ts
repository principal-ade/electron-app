import { BrowserWindow } from 'electron';
import type { IModernApplicationWindow } from '../window/types';
import { GitHubAdapter } from '../version-control-providers/githubHandlers';
export declare class ElectronFileSystemAdapter {
    private rootPath;
    private fileWatcher;
    private directoryWatcher;
    private filesWatcher;
    private gitWatcher;
    private mainWindow;
    private currentlyWatchingPath;
    private githubAdapter;
    constructor();
    setMainWindow(window: BrowserWindow): void;
    setGitHubAdapter(adapter: GitHubAdapter): void;
    readFile(filePath: string): Promise<{
        content: string;
        filePath: string;
    } | null>;
    selectFile(): Promise<{
        content: string;
        filePath: string;
    } | null>;
    selectDirectory(options?: {
        title?: string;
        buttonLabel?: string;
        properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
    }): Promise<{
        canceled: boolean;
        filePaths?: undefined;
    } | {
        filePaths: string[];
        canceled: boolean;
    } | null>;
    writeFile(filePath: string, content: string): Promise<{
        success: boolean;
        filePath: string;
        error?: undefined;
    } | {
        success: boolean;
        filePath: string;
        error: string;
    } | null>;
    getHomePath(): Promise<string>;
    getCurrentWorkingDirectory(): Promise<string>;
    getFileStats(filePath: string): Promise<{
        size: number;
        isDirectory: boolean;
        lastModified: Date;
    } | null>;
    getDirectoryStats(dirPath: string): Promise<{
        totalFiles: number;
        totalDirectories: number;
        totalSize: number;
    } | null>;
    readDirectory(dirPath: string): Promise<string[]>;
    watchFile(filePath: string): Promise<boolean>;
    watchDirectory(options: {
        directoryPath: string;
        fileTypes?: string[];
        isSubdirectory?: boolean;
    }): Promise<boolean>;
    private createFileWatcher;
    private createGitWatcher;
    private setupDirectoryWatcherEvents;
    watchGitRepository(repoPath: string): Promise<boolean>;
    stopWatchingGit(): Promise<boolean>;
    stopWatching(): Promise<boolean>;
    stopWatchingFile(filePath: string): Promise<boolean>;
    stopWatchingDirectory(directoryPath: string): Promise<boolean>;
    private findFilesWithExtensions;
    /**
     * Glob pattern matching for files
     */
    glob(pattern: string, options?: {
        cwd?: string;
    }): Promise<string[]>;
    private findFilesWithGlobPattern;
    addPathToDirectoryWatcher(newPathToAdd: string): Promise<boolean>;
    stopWatchingSubdirectory(subdirectoryPath: string): Promise<boolean>;
    watchFiles(options: {
        filePaths: string[];
    }): Promise<boolean>;
    stopWatchingFiles(): Promise<boolean>;
    /**
     * Build a filtered file tree using globby with automatic .gitignore support
     */
    buildFilteredFileTree(directoryPath: string, options?: {
        gitignore?: boolean;
        ignorePatterns?: string[];
        includeStats?: boolean;
    }): Promise<{
        paths: string[];
        stats?: Array<{
            path: string;
            size: number;
            isDirectory: boolean;
            lastModified: Date;
        }>;
    }>;
}
export declare function registerFileSystemIpcHandlers(appWindows: Map<number, IModernApplicationWindow>): void;
//# sourceMappingURL=fileSystemHandlers.d.ts.map