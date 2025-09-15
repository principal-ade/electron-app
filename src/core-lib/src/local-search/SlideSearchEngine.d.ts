/**
 * SlideSearchEngine - Main search engine implementation
 */
import { SearchStorageAdapter, SearchEngineAdapter } from './adapters';
import { IndexingOptions, IndexResult, SearchEngineConfig, SearchIndexStats } from './adapters/types';
import { type SearchableDocument, type SearchResult, type SearchOptions } from './types';
export declare class SlideSearchEngine {
    private indexer;
    private searchEngine;
    private storage;
    private fileSystem;
    private indexKey;
    constructor(config: SearchEngineConfig, indexKey?: string);
    /**
     * Initialize the search engine, loading any existing index
     */
    initialize(): Promise<void>;
    /**
     * Index all markdown files in the workspace
     */
    indexFiles(options?: IndexingOptions): Promise<IndexResult>;
    /**
     * Search the index
     */
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Get index statistics
     */
    getStats(): Promise<SearchIndexStats | null>;
    /**
     * Check if index exists
     */
    hasIndex(): Promise<boolean>;
    /**
     * Clear the index
     */
    clearIndex(): Promise<void>;
    /**
     * Update specific files in the index
     */
    updateFiles(filePaths: string[], options?: IndexingOptions): Promise<IndexResult>;
    /**
     * Index documents directly (for non-file-based content like notes)
     */
    indexDocuments(documents: SearchableDocument[], options?: IndexingOptions): Promise<IndexResult>;
    /**
     * Save the current index to storage
     */
    saveIndex(): Promise<void>;
    /**
     * Get direct access to the search engine adapter (use with caution)
     */
    getSearchAdapter(): SearchEngineAdapter;
    /**
     * Get direct access to the storage adapter (use with caution)
     */
    getStorageAdapter(): SearchStorageAdapter;
}
//# sourceMappingURL=SlideSearchEngine.d.ts.map