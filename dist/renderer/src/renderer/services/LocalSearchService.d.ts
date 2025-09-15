import { FileTree } from "@principal-ai/repository-abstraction";
import { ContentProvider } from './ContentProviders';
export interface FileDocument {
    id: string;
    path: string;
    name: string;
    content?: string;
    relativePath: string;
}
export interface SearchResult {
    path: string;
    name: string;
    relativePath: string;
    score: number;
    matches?: Array<{
        field: 'name' | 'path' | 'content';
        positions: number[];
    }>;
}
export interface ContentMatch {
    snippet: string;
    lineNumber: number;
    matchedText: string;
}
export interface LocalSearchResult {
    path: string;
    name: string;
    relativePath: string;
    matchTypes: Set<'filename' | 'content'>;
    filenameMatch?: {
        matchedPart: string;
        startIndex: number;
        endIndex: number;
    };
    contentMatches?: ContentMatch[];
    relevanceScore: number;
}
declare class LocalSearchService {
    private fileIndex;
    private initialized;
    private documentsMap;
    private baseDirectory;
    private contentProvider;
    constructor();
    /**
     * Set the content provider for this search service
     */
    setContentProvider(provider: ContentProvider): void;
    /**
     * Get current content provider
     */
    getContentProvider(): ContentProvider;
    /**
     * Check if content search is available
     */
    canSearchContent(): boolean;
    /**
     * Index files from FileTree
     */
    indexFileSystemTree(tree: FileTree, baseDirectory: string): Promise<void>;
    /**
     * Convert glob pattern to regex
     */
    private globToRegex;
    /**
     * Check if query contains wildcards
     */
    private hasWildcards;
    /**
     * Search files using FlexSearch or wildcard matching
     */
    search(query: string, options?: {
        searchIn?: ('name' | 'path' | 'content')[];
        limit?: number;
        directoryFilter?: string;
        excludeDirectory?: boolean;
        fileType?: string;
    }): SearchResult[];
    /**
     * Perform wildcard search using regex
     */
    private wildcardSearch;
    /**
     * Check if document matches filter options
     */
    private matchesFilters;
    /**
     * Search file contents using Electron's file reading
     */
    searchFileContents(query: string, files: string[], options?: {
        maxResults?: number;
        contextLines?: number;
    }): Promise<Map<string, ContentMatch[]>>;
    /**
     * Get suggestions for partial queries
     */
    suggest(query: string, field?: 'name' | 'path', limit?: number): string[];
    /**
     * Clear the search index
     */
    clear(): void;
    /**
     * Get all indexed files
     */
    getAllFiles(): FileDocument[];
}
export declare const localSearchService: LocalSearchService;
export {};
//# sourceMappingURL=LocalSearchService.d.ts.map