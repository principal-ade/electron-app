/**
 * Local Search Module - Core search functionality without UI dependencies
 *
 * Exports will be added here as they are needed by consumers.
 * This module provides search capabilities for local document indexing and searching.
 */
// Core search engine - needed for VSCode DocsView
export { SlideSearchEngine } from './SlideSearchEngine';
export { SearchEngineFactory } from './SearchEngineFactory';
export { SlideIndexer } from './SlideIndexer';
// Adapters (for direct use if needed)
export { FlexSearchAdapter } from './adapters/implementations/FlexSearchAdapter';
// VSCode specific adapters
export { VSCodeStorageAdapter, VSCodeFileSystemAdapter } from './adapters/implementations/vscode';
//# sourceMappingURL=index.js.map