# Markdown Search Implementation

## Overview
The markdown search functionality provides full-text search across all documentation in Alexandria repositories. It uses the `@principal-ai/markdown-search` library and runs entirely in the main process with IPC communication to the renderer.

## Architecture

### Core Components

1. **DocumentIndexingService** (`src/main/services/DocumentIndexingService.ts`)
   - Main process service that handles all search and indexing operations
   - Integrates with AlexandriaRegistryService for repository management
   - Uses batch indexing approach (indexes all repositories together)
   - No real-time file watching or incremental updates

2. **IPC Communication** (`src/shared/ipc/DocumentSearchIPC.ts`)
   - Defines channels for renderer-main process communication
   - Supports search, indexing, status queries, and event notifications
   - Channel prefix: `document-search:`

3. **Search Engine**
   - Uses FlexSearchAdapter for performant searching
   - NodeStorageAdapter for persistent index storage
   - Storage location: `{userData}/document-index/search-index`

## Key Features

### Batch Indexing
- Indexes all Alexandria repositories as a single batch operation
- No per-repository tracking or incremental updates
- Triggered manually or when repositories are added/removed

### Search Capabilities
- Full-text search across all indexed documents
- Supports search options from `@principal-ai/markdown-search`:
  - Query limits
  - Score filtering
  - Tag filtering
- Can filter results by repository path

### Storage & Persistence
- Indexes are persisted to disk automatically
- Loaded on application startup
- Storage path configurable via service configuration

## Implementation Details

### Initialization Flow
```typescript
1. Service creates FlexSearchAdapter with performance preset
2. Initializes NodeStorageAdapter with storage path
3. Creates multi-repository markdown provider
4. Initializes SearchEngine with configuration
5. Loads persisted index if available
```

### Indexing Process
```typescript
1. Receives list of Alexandria repositories
2. For each repository:
   - Uses AlexandriaRegistryService.getRepositoryDocumentsWithExclusions()
   - Gets ALL markdown documents via getAllDocs() (respecting .gitignore)
   - Returns excluded docs for information only (not filtered out)
   - Converts document paths to MarkdownFile format
   - Adds to batch for indexing
3. SearchEngine.indexFiles() processes all documents
4. Progress events sent via IPC during indexing
5. Index saved to disk after completion
```

### Search Flow
```typescript
1. Renderer sends search request via IPC
2. DocumentIndexingService.searchDocuments() executes search
3. Optional filters applied:
   - Repository path filtering
   - Minimum score filtering
   - Tag filtering
4. Results returned via IPC response
```

## API Reference

### Main Process Service Methods

```typescript
class DocumentIndexingService {
  // Initialize the service
  async initialize(config?: SearchServiceConfig): Promise<void>

  // Index all Alexandria repositories
  async indexAlexandriaRepositories(
    repositories: Array<{ path: string; name?: string }>
  ): Promise<IndexResult>

  // Search indexed documents
  async searchDocuments(
    request: SearchDocumentsRequest
  ): Promise<SearchDocumentsResponse>

  // Get indexing status
  async getStatus(): Promise<GetIndexStatusResponse>

  // Refresh index for current repositories
  async refreshIndex(): Promise<void>

  // Clear entire index
  async clearIndex(): Promise<void>
}
```

### IPC Channels

```typescript
enum DocumentSearchChannel {
  // Commands (renderer -> main)
  INITIALIZE = 'document-search:initialize',
  INDEX_MULTIPLE = 'document-search:index-multiple',
  SEARCH = 'document-search:search',
  GET_STATUS = 'document-search:get-status',
  REFRESH_INDEX = 'document-search:refresh-index',
  CLEAR_INDEX = 'document-search:clear-index',

  // Events (main -> renderer)
  INDEX_UPDATE = 'document-search:index-update',
  DOCUMENT_CHANGED = 'document-search:document-changed',
  INDEX_ERROR = 'document-search:index-error'
}
```

## Current Limitations

1. **No Incremental Indexing**
   - Must re-index all documents when content changes
   - No support for adding/updating individual documents
   - See commented code referencing `MARKDOWN_SEARCH_FEATURE_REQUEST.md`

2. **No Custom Metadata**
   - Cannot attach repository metadata to documents during indexing
   - Search results don't include repository context in metadata
   - Library limitation - waiting for upstream support

3. **No Real-time Updates**
   - No file watching implementation
   - Changes require manual re-indexing
   - Original chokidar integration was removed

4. **Limited Repository Management**
   - All repositories indexed together
   - Cannot remove individual repository from index
   - No per-repository document counts

## Future Improvements

### Priority 1: Incremental Updates
- Add support for updating individual documents
- Implement file watching with chokidar
- Enable repository-specific operations

### Priority 2: Metadata Support
- Attach repository information to documents
- Enable filtering by custom metadata fields
- Improve search result context

### Priority 3: Performance Optimization
- Implement parallel indexing for large repositories
- Add caching for frequent searches
- Optimize memory usage for large indexes

## Configuration

### Service Configuration
```typescript
interface SearchServiceConfig {
  maxDocumentsInMemory?: number;  // Memory limit for documents
  enableWatching?: boolean;        // Currently unused
  autoIndex?: boolean;             // Auto-index on repository add
  persistIndex?: boolean;          // Save index to disk
  storagePath?: string;            // Custom storage location
}
```

### Default Settings
- Storage: `{userData}/document-index/search-index`
- Persistence: Enabled
- Auto-indexing: Enabled
- File watching: Disabled (not implemented)

## Usage Example

```typescript
// In main process
const indexingService = new DocumentIndexingService();
await indexingService.initialize();

// Index repositories
const repositories = [
  { path: '/path/to/repo1', name: 'Repo 1' },
  { path: '/path/to/repo2', name: 'Repo 2' }
];
await indexingService.indexAlexandriaRepositories(repositories);

// Search
const results = await indexingService.searchDocuments({
  query: 'search term',
  options: { limit: 50 },
  repositories: ['/path/to/repo1']  // Optional filtering
});
```

## Dependencies

- `@principal-ai/markdown-search`: ^2.0.7 - Core search functionality
- `electron`: IPC communication and app paths
- Node.js fs/promises: File system operations
- path: Path manipulation

## Related Files

- `src/main/services/DocumentIndexingService.ts` - Main implementation
- `src/shared/ipc/DocumentSearchIPC.ts` - IPC type definitions
- `src/window/main-process-api-implementations/documentSearchApi.ts` - IPC handlers
- `src/main/services/ipc/documentSearchHandlers.ts` - IPC registration
- `src/main/stores/AlexandriaRegistryService.ts` - Repository management