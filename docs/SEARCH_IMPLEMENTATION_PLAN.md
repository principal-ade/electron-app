# Document Search Implementation Plan

## Overview
This document outlines the implementation plan for the document search functionality, including backend indexing service and document discovery requirements.

## 1. Backend Indexing Service Architecture

### Location: Main Process
The indexing service must run in the main process due to Node.js dependencies in @a24z libraries.

### Core Components

```typescript
// src/main/services/DocumentIndexingService.ts
class DocumentIndexingService {
  private searchEngine: SearchEngine; // from @a24z/markdown-search
  private indexer: DocumentIndexer;
  private repositories: Map<string, RepositoryIndex>;
  private watcher: chokidar.FSWatcher;

  // Core methods
  async initialize(): Promise<void>
  async indexRepository(repoPath: string): Promise<IndexResult>
  async search(query: string, options: SearchOptions): Promise<SearchResult[]>
  async updateDocument(filePath: string): Promise<void>
  async removeDocument(filePath: string): Promise<void>
  getIndexStatus(): IndexStatus
}
```

### IPC API Design

```typescript
// src/shared/ipc-channels/document-search.ts
export enum DocumentSearchChannel {
  // Commands
  INITIALIZE_INDEX = 'document-search:initialize',
  INDEX_REPOSITORY = 'document-search:index-repo',
  SEARCH_DOCUMENTS = 'document-search:search',
  GET_INDEX_STATUS = 'document-search:status',

  // Events (main -> renderer)
  INDEX_UPDATE = 'document-search:index-update',
  DOCUMENT_CHANGED = 'document-search:doc-changed',
  INDEX_ERROR = 'document-search:error'
}

// API exposed to renderer
interface DocumentSearchAPI {
  initialize(): Promise<void>;
  indexRepository(repoPath: string): Promise<IndexResult>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getIndexStatus(): Promise<IndexStatus>;

  // Event subscriptions
  onIndexUpdate(callback: (status: IndexStatus) => void): Disposable;
  onDocumentChanged(callback: (change: DocumentChange) => void): Disposable;
}
```

### Implementation Flow

1. **Initialization** (on app start)
   - Create SearchEngine instance with FlexSearchAdapter
   - Load persisted index from disk (if exists)
   - Register IPC handlers

2. **Repository Indexing**
   - Triggered when user opens a repository
   - Scan for markdown documents
   - Parse and index each document
   - Set up file watchers

3. **Search Execution**
   - Receive query from renderer
   - Execute search in main process
   - Return results via IPC

4. **Real-time Updates**
   - Watch indexed files with chokidar
   - Re-index on changes
   - Notify renderer of updates

## 2. Document Discovery Requirements

### Requirements for @a24z/core-library Team

We need the following APIs to properly discover and index documents:

```typescript
// Proposed API for @a24z/core-library
interface DocumentDiscoveryAPI {
  /**
   * Get all indexable documents for a repository
   * Should return paths to all markdown files that should be indexed
   */
  getIndexableDocuments(repoPath: string): Promise<IndexableDocument[]>;

  /**
   * Get document metadata without reading full content
   * Useful for quick scanning and filtering
   */
  getDocumentMetadata(filePath: string): Promise<DocumentMetadata>;

  /**
   * Get watch patterns for document changes
   * Returns glob patterns that should be watched for changes
   */
  getWatchPatterns(repoPath: string): string[];

  /**
   * Check if a file should be indexed
   * Considers .gitignore, custom ignore patterns, etc.
   */
  shouldIndexFile(filePath: string, repoPath: string): boolean;
}

interface IndexableDocument {
  path: string;              // Absolute path to document
  relativePath: string;       // Path relative to repo root
  type: 'markdown' | 'mdx' | 'rst' | 'txt';
  category?: 'docs' | 'planning' | 'notes' | 'readme';
  priority: 'high' | 'medium' | 'low';  // For indexing order
  metadata?: {
    title?: string;
    tags?: string[];
    lastModified: Date;
    author?: string;
  };
}
```

### Interim Document Scanner (Until API is Available)

```typescript
// src/main/services/DocumentScanner.ts
class InterimDocumentScanner {
  // Default patterns to scan
  private readonly PATTERNS = [
    '**/*.md',
    '**/*.mdx',
    '**/README*',
    '**/CHANGELOG*',
    '**/CONTRIBUTING*'
  ];

  // Common documentation directories
  private readonly DOC_DIRS = [
    'docs',
    'documentation',
    '.principleMD',
    'wiki',
    'guides',
    'tutorials'
  ];

  // Ignore patterns
  private readonly IGNORE = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**'
  ];

  async scanRepository(repoPath: string): Promise<IndexableDocument[]> {
    // 1. Use fast-glob to find all matching files
    // 2. Filter using ignore patterns
    // 3. Extract metadata from frontmatter if present
    // 4. Categorize based on path patterns
    // 5. Return sorted by priority
  }

  async extractMetadata(filePath: string): Promise<DocumentMetadata> {
    // 1. Read first few lines to check for frontmatter
    // 2. Parse YAML/TOML frontmatter if present
    // 3. Extract title from first # heading if no frontmatter
    // 4. Get file stats for lastModified
  }
}
```

## 3. Integration Points

### With Alexandria Service
- Index repositories when added to Alexandria
- Remove index when repository is removed
- Share repository metadata

### With Repository Manager
- Auto-index when opening repository view
- Show index status in UI
- Provide search entry point

### With Planning View
- Index planning documents (.principleMD)
- Special handling for Excalidraw files
- Search within planning context

## 4. Data Persistence

### Index Storage
```typescript
interface IndexStorage {
  // Store index per repository
  saveIndex(repoId: string, data: SerializedIndex): Promise<void>;
  loadIndex(repoId: string): Promise<SerializedIndex | null>;
  deleteIndex(repoId: string): Promise<void>;

  // Storage location: app.getPath('userData')/search-index/
  // Format: SQLite or LevelDB for better performance
}
```

### Cache Strategy
- Memory cache for active repositories
- Disk persistence for quick startup
- Incremental updates to avoid full re-index
- Version tracking for index format changes

## 5. Performance Considerations

### Indexing Strategy
- **Parallel processing**: Index multiple files concurrently
- **Chunked indexing**: Process in batches to avoid blocking
- **Priority queue**: Index important docs first (README, main docs)
- **Incremental updates**: Only re-index changed files

### Memory Management
- Limit in-memory index size
- Use WeakMap for document cache
- Clear unused repository indexes
- Implement LRU cache for search results

### Search Optimization
- Debounce search requests from renderer
- Cache recent search results
- Pre-fetch related documents
- Use Web Workers for heavy processing (if needed)

## 6. Error Handling

### Graceful Degradation
- Continue working if some documents fail to index
- Provide partial results if index is incomplete
- Fall back to simple file search if index corrupted
- Clear error reporting to user

### Recovery Mechanisms
- Auto-retry failed indexing operations
- Rebuild index command for users
- Export/import index for backup
- Health check on startup

## 7. Testing Strategy

### Unit Tests
- Document scanner with various file structures
- Indexing with different document formats
- Search query parsing and execution
- IPC communication layer

### Integration Tests
- Full indexing of sample repository
- Search across multiple repositories
- File watcher integration
- Performance benchmarks

### E2E Tests
- User search flow from UI
- Repository indexing on add
- Real-time update on file change
- Search result interaction

## 8. Timeline & Priorities

### Phase 1: Core Implementation (Week 1-2)
1. ✅ UI Components (Complete)
2. DocumentIndexingService skeleton
3. IPC API implementation
4. Basic document scanner

### Phase 2: Integration (Week 3)
1. Connect to Alexandria repositories
2. Add file watchers
3. Implement persistence
4. Error handling

### Phase 3: Optimization (Week 4)
1. Performance tuning
2. Advanced search features
3. Testing & bug fixes
4. Documentation

## 9. Open Questions for @a24z/core-library Team

1. **Document Discovery**
   - What constitutes an "indexable" document?
   - Should we index code comments?
   - How to handle private/sensitive documents?

2. **Metadata Standards**
   - Preferred frontmatter format (YAML/TOML)?
   - Standard metadata fields?
   - Category taxonomy?

3. **Watch Patterns**
   - Which file changes should trigger re-index?
   - How to handle git operations (branch switch)?
   - Should we watch .gitignore changes?

4. **Performance Targets**
   - Expected index size per repository?
   - Target search response time?
   - Maximum concurrent indexes?

## 10. Success Metrics

- Index 1000 documents in < 10 seconds
- Search response time < 100ms
- Memory usage < 200MB for large repos
- 95% search result accuracy
- Real-time updates within 1 second

## Appendix: Example Implementation

### Quick Start Implementation
```typescript
// main/services/DocumentIndexingService.ts
import { SearchEngine, DocumentIndexer } from '@a24z/markdown-search';
import { ipcMain } from 'electron';
import chokidar from 'chokidar';

export class DocumentIndexingService {
  private engine: SearchEngine;

  async initialize() {
    this.engine = new SearchEngine({
      adapter: new FlexSearchAdapter(),
      storage: new NodeStorageAdapter()
    });

    this.registerIPCHandlers();
  }

  private registerIPCHandlers() {
    ipcMain.handle('document-search:search', async (_, query, options) => {
      return this.engine.search(query, options);
    });

    ipcMain.handle('document-search:index-repo', async (_, repoPath) => {
      return this.indexRepository(repoPath);
    });
  }

  private async indexRepository(repoPath: string) {
    const scanner = new InterimDocumentScanner();
    const documents = await scanner.scanRepository(repoPath);

    for (const doc of documents) {
      await this.engine.index(doc);
    }

    this.watchRepository(repoPath);
  }

  private watchRepository(repoPath: string) {
    const watcher = chokidar.watch('**/*.md', {
      cwd: repoPath,
      ignored: ['**/node_modules/**']
    });

    watcher.on('change', (path) => {
      this.updateDocument(path);
    });
  }
}