/**
 * Search engine adapter interface for abstracting the search implementation
 */
import { SearchableDocument, SearchResult, SearchOptions } from '../types';
import { SearchEngineOptions, SerializedIndexData } from './types';
export interface SearchEngineAdapter {
    /**
     * Initialize the search engine
     */
    initialize(options?: SearchEngineOptions): Promise<void>;
    /**
     * Add documents to the search index
     */
    addDocuments(documents: SearchableDocument[]): Promise<void>;
    /**
     * Remove documents from the search index
     */
    removeDocuments(ids: string[]): Promise<void>;
    /**
     * Search the index with the given query
     */
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Export the index for persistence
     */
    exportIndex(): Promise<SerializedIndexData>;
    /**
     * Import index from persisted data
     */
    importIndex(data: SerializedIndexData): Promise<void>;
    /**
     * Clear all data from the index
     */
    clear(): Promise<void>;
    /**
     * Start a new indexing session (optional method)
     * Resets internal state to prepare for a new batch of document additions
     */
    startNewIndexingSession?(): void;
}
//# sourceMappingURL=SearchEngineAdapter.d.ts.map