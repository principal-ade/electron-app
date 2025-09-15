import { SearchableDocument, SearchResult, SearchOptions } from '../types';
/**
 * File system adapter interface for accessing markdown files across platforms
 */
export interface FileInfo {
    path: string;
    name: string;
    size: number;
    modifiedAt: Date;
    uri?: string;
}
export interface FindOptions {
    include?: string[];
    exclude?: string[];
    maxDepth?: number;
    followSymlinks?: boolean;
}
export interface FileWatchEvent {
    type: 'created' | 'changed' | 'deleted';
    path: string;
}
export type FileWatchCallback = (event: FileWatchEvent) => void;
export interface Disposable {
    dispose(): void;
}
export interface SearchFileSystemAdapter {
    /**
     * Find all markdown files in the workspace
     *
     * IMPORTANT: Implementations should use mergeExclusions() from '../constants'
     * to ensure consistent default exclusions across all platforms
     */
    findMarkdownFiles(options?: FindOptions): Promise<FileInfo[]>;
    readFile(path: string): Promise<string>;
    watchFiles?(pattern: string, callback: FileWatchCallback): Disposable;
    getRelativePath(path: string): string;
    getFileInfo(path: string): Promise<FileInfo>;
}
export interface SearchEngineAdapter {
    initialize(options?: SearchEngineOptions): Promise<void>;
    addDocuments(documents: SearchableDocument[]): Promise<void>;
    removeDocuments(ids: string[]): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    exportIndex(): Promise<SerializedIndexData>;
    importIndex(data: SerializedIndexData): Promise<void>;
    clear(): Promise<void>;
}
export interface SearchEngineConfig {
    storage: SearchStorageAdapter;
    fileSystem: SearchFileSystemAdapter;
    searchEngine?: SearchEngineAdapter;
}
export type SearchEngineOptionValue = string | number | boolean | object | undefined;
export type SerializedIndexData = unknown;
export type IndexStatsData = unknown;
export interface SearchEngineOptions {
    [key: string]: SearchEngineOptionValue;
}
export interface SearchIndexData {
    version: string;
    timestamp: string;
    engine: string;
    index: Record<string, SerializedIndexData>;
    documents: Array<[string, SearchableDocument]>;
}
export interface SearchStorageAdapter {
    saveIndex(key: string, data: SerializedIndexData): Promise<void>;
    loadIndex(key: string): Promise<SerializedIndexData | null>;
    deleteIndex(key: string): Promise<void>;
    hasIndex(key: string): Promise<boolean>;
    getIndexMetadata(key: string): Promise<IndexMetadata | null>;
}
export interface IndexingOptions {
    indexChunks?: boolean;
    fileOptions?: FindOptions;
    batchSize?: number;
    clearBefore?: boolean;
    onProgress?: (progress: IndexingProgress) => void;
}
export type IndexingPhase = 'discovering' | 'parsing' | 'indexing' | 'persisting' | 'complete';
export interface IndexingProgress {
    phase: IndexingPhase;
    currentFile?: string;
    filesProcessed: number;
    totalFiles: number;
    documentsIndexed: number;
    percentage: number;
    foundFiles?: {
        list: string[];
        total: number;
        hasMore: boolean;
    };
}
export interface IndexMetadata {
    version: string;
    createdAt: string;
    updatedAt: string;
    stats: SearchIndexStats;
}
export interface SearchIndexStats {
    totalFiles: number;
    totalSlides: number;
    totalDocuments?: number;
    totalSize?: string;
    indexedAt: string;
}
export interface IndexResult {
    filesIndexed: number;
    slidesIndexed: number;
    documentsIndexed?: number;
    errors?: IndexError[];
    duration: number;
}
export interface IndexError {
    file: string;
    error: string;
    stack?: string;
}
