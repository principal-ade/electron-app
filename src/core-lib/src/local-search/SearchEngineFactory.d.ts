/**
 * Factory for creating search engine adapters
 */
import { SearchEngineAdapter, SearchEngineOptions } from './adapters/types';
export type SearchEngineType = 'flexsearch' | 'fuse' | 'lunr' | 'minisearch' | 'orama';
export interface SearchEngineFactoryOptions {
    type: SearchEngineType;
    options?: SearchEngineOptions;
}
export declare class SearchEngineFactory {
    /**
     * Create a search engine adapter of the specified type
     */
    static create(type: SearchEngineType, options?: SearchEngineOptions): SearchEngineAdapter;
    /**
     * Get the default search engine type
     */
    static getDefault(): SearchEngineType;
    /**
     * Check if a search engine type is available
     */
    static isAvailable(type: SearchEngineType): boolean;
    /**
     * Get all available search engine types
     */
    static getAvailable(): SearchEngineType[];
    /**
     * Create an in-memory search engine (convenience method)
     */
    static createInMemoryEngine(options?: Partial<SearchEngineOptions>): SearchEngineAdapter;
}
//# sourceMappingURL=SearchEngineFactory.d.ts.map