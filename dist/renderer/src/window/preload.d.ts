export interface WatchOptions {
    directoryPath: string;
    fileTypes?: string[];
    currentFilePath?: string;
}
export interface FileWatchOptions {
    filePath: string;
}
export interface FileChangeEvent {
    type: string;
    path: string;
    extension?: string;
    stats?: any;
    isCurrentFile?: boolean;
}
export interface MarkdownFileOptions {
    depth?: number;
    loadChildren?: boolean;
}
//# sourceMappingURL=preload.d.ts.map