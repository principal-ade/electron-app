/**
 * Local Search Module - Core search functionality without UI dependencies
 *
 * Exports will be added here as they are needed by consumers.
 * This module provides search capabilities for local document indexing and searching.
 */
export { SlideSearchEngine } from './SlideSearchEngine';
export { SearchEngineFactory } from './SearchEngineFactory';
export { SlideIndexer } from './SlideIndexer';
export { FlexSearchAdapter } from './adapters/implementations/FlexSearchAdapter';
export { VSCodeStorageAdapter, VSCodeFileSystemAdapter } from './adapters/implementations/vscode';
export type { SearchStorageAdapter, SearchFileSystemAdapter, SearchEngineAdapter, SearchEngineConfig, } from './adapters/types';
export type { SearchableDocument, SearchResult, SearchOptions, SlideDocument } from './types';
export type { IndexingOptions, IndexResult, IndexingProgress, SearchIndexStats, } from './adapters/types';
//# sourceMappingURL=index.d.ts.map