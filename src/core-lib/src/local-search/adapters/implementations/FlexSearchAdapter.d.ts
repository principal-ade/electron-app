/**
 * FlexSearch implementation of SearchEngineAdapter
 * High-performance full-text search library
 */
import { SearchableDocument, SearchResult, SearchOptions } from '../../types';
import { SearchEngineAdapter, SearchEngineOptions } from '../types';
interface FlexSearchOptions extends SearchEngineOptions {
    preset?: 'memory' | 'performance' | 'match' | 'score' | 'default';
    tokenize?: 'strict' | 'forward' | 'reverse' | 'full';
    resolution?: number;
    context?: boolean | {
        depth: number;
        bidirectional: boolean;
        resolution: number;
    };
    optimize?: boolean;
    boost?: (search: {
        field: string;
        query: string;
        match: string;
    }) => number;
}
export declare class FlexSearchAdapter implements SearchEngineAdapter {
    private index;
    private documents;
    private options;
    private indexCleared;
    private sessionId;
    constructor(options?: FlexSearchOptions);
    initialize(options?: SearchEngineOptions): Promise<void>;
    addDocuments(documents: SearchableDocument[]): Promise<void>;
    removeDocuments(ids: string[]): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    exportIndex(): Promise<unknown>;
    importIndex(data: unknown): Promise<void>;
    clear(): Promise<void>;
    /**
     * Start a new indexing session - resets the indexCleared flag
     * This should be called before starting a new batch of addDocuments calls
     */
    startNewIndexingSession(): void;
    /**
     * Create match information for a query in content
     */
    private createMatchInfo;
    /**
     * Create match context with before/after text
     */
    private createMatchContext;
    /**
     * Create highlighted content snippet
     */
    private createHighlights;
    /**
     * Type guard for import data
     */
    private isValidImportData;
}
export {};
//# sourceMappingURL=FlexSearchAdapter.d.ts.map