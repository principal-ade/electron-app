/**
 * VS Code implementation of SearchFileSystemAdapter
 * Uses VS Code's workspace API for file system operations
 */
import { SearchFileSystemAdapter, FileInfo, FindOptions, FileWatchCallback, Disposable } from '../../types';
export interface VSCodeAPI {
    workspace: {
        findFiles(include: string, exclude?: string | null, maxResults?: number): Thenable<any[]>;
        openTextDocument(uri: any): Thenable<{
            getText(): string;
        }>;
        createFileSystemWatcher(pattern: string): any;
        asRelativePath(path: string): string;
        workspaceFolders?: Array<{
            uri: {
                fsPath?: string;
                path: string;
            };
        }>;
        fs: {
            stat(uri: any): Thenable<{
                ctime: number;
                mtime: number;
                size: number;
            }>;
        };
    };
    Uri: {
        parse(path: string): any;
        file(path: string): any;
    };
}
interface Thenable<T> {
    then<TResult>(onfulfilled?: (value: T) => TResult | Thenable<TResult>, onrejected?: (reason: any) => TResult | Thenable<TResult>): Thenable<TResult>;
}
export declare class VSCodeFileSystemAdapter implements SearchFileSystemAdapter {
    private vscode;
    constructor(vscode: VSCodeAPI);
    findMarkdownFiles(options?: FindOptions): Promise<FileInfo[]>;
    readFile(path: string): Promise<string>;
    watchFiles(pattern: string, callback: FileWatchCallback): Disposable;
    getRelativePath(path: string): string;
    getFileInfo(path: string): Promise<FileInfo>;
    /**
     * Check if a file exists
     */
    exists(path: string): Promise<boolean>;
    /**
     * Get workspace root path(s)
     */
    getWorkspaceRoots(): string[];
}
export {};
//# sourceMappingURL=VSCodeFileSystemAdapter.d.ts.map