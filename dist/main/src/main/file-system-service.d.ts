export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
    content?: string;
    size?: number;
}
export interface FileTreeOptions {
    maxDepth?: number;
    includeContent?: boolean;
    exclude?: string[];
    maxFileSize?: number;
}
export declare class FileSystemService {
    private static readonly DEFAULT_EXCLUDE;
    private static readonly DEFAULT_MAX_FILE_SIZE;
    static getDirectoryTree(dirPath: string, options?: FileTreeOptions): Promise<FileTreeNode>;
    private static buildTree;
    static loadAllTextFiles(dirPath: string, options?: Partial<FileTreeOptions>): Promise<Map<string, string>>;
    private static collectFileContents;
    static getAvailableLocalClones(): Promise<Array<{
        path: string;
        name: string;
        remote?: string;
    }>>;
}
//# sourceMappingURL=file-system-service.d.ts.map