/**
 * IPC Channel Definitions for Document Search
 *
 * This module defines the IPC communication protocol between
 * the main process (where indexing happens) and the renderer
 * process (where the UI lives).
 */

import type {
  SearchResult,
  SearchOptions,
  DocumentType,
} from '@principal-ai/markdown-search';

// ============================================================================
// Channel Names
// ============================================================================

export enum DocumentSearchChannel {
  // Commands (renderer -> main)
  INITIALIZE = 'document-search:initialize',
  INDEX_REPOSITORY = 'document-search:index-repository',
  INDEX_MULTIPLE = 'document-search:index-multiple',
  REMOVE_REPOSITORY = 'document-search:remove-repository',
  SEARCH = 'document-search:search',
  GET_STATUS = 'document-search:get-status',
  GET_DOCUMENT = 'document-search:get-document',
  REFRESH_INDEX = 'document-search:refresh-index',
  CLEAR_INDEX = 'document-search:clear-index',

  // Events (main -> renderer)
  INDEX_UPDATE = 'document-search:index-update',
  DOCUMENT_CHANGED = 'document-search:document-changed',
  INDEX_ERROR = 'document-search:index-error',
  SEARCH_READY = 'document-search:search-ready',
  REPOSITORY_INDEXED = 'document-search:repository-indexed',
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Initialize the search service
 */
export interface InitializeSearchRequest {
  /**
   * Whether to load persisted index from disk
   */
  loadPersistedIndex?: boolean;

  /**
   * Custom configuration
   */
  config?: SearchServiceConfig;
}

export interface SearchServiceConfig {
  /**
   * Maximum number of documents to keep in memory
   */
  maxDocumentsInMemory?: number;

  /**
   * Enable file watching
   */
  enableWatching?: boolean;

  /**
   * Auto-index repositories when added
   */
  autoIndex?: boolean;

  /**
   * Persist index to disk
   */
  persistIndex?: boolean;

  /**
   * Index storage path
   */
  storagePath?: string;
}

/**
 * Index a repository
 */
export interface IndexRepositoryRequest {
  /**
   * Repository path
   */
  path: string;

  /**
   * Repository identifier
   */
  id?: string;

  /**
   * Repository name for display
   */
  name?: string;

  /**
   * Force full re-index even if already indexed
   */
  force?: boolean;

  /**
   * Options for indexing
   */
  options?: IndexingOptions;
}

export interface IndexingOptions {
  /**
   * Include draft documents
   */
  includeDrafts?: boolean;

  /**
   * Document types to index
   */
  documentTypes?: DocumentType[];

  /**
   * Maximum file size (bytes)
   */
  maxFileSize?: number;

  /**
   * Custom ignore patterns
   */
  ignore?: string[];

  /**
   * Priority paths to index first
   */
  priorityPaths?: string[];
}

export interface IndexRepositoryResponse {
  /**
   * Whether indexing succeeded
   */
  success: boolean;

  /**
   * Number of documents indexed
   */
  documentsIndexed: number;

  /**
   * Number of documents failed
   */
  documentsFailed: number;

  /**
   * Time taken (ms)
   */
  duration: number;

  /**
   * Error if failed
   */
  error?: string;

  /**
   * Failed documents with reasons
   */
  failures?: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Response for batch indexing multiple repositories
 */
export interface IndexMultipleRepositoriesResponse {
  /**
   * Total number of documents indexed across all repositories
   */
  totalIndexed: number;

  /**
   * Total number of repositories that failed
   */
  totalFailed: number;

  /**
   * Results for each repository
   */
  results: Array<{
    name: string;
    success: boolean;
    documentsIndexed?: number;
    error?: string;
  }>;
}

/**
 * Search for documents
 */
export interface SearchDocumentsRequest {
  /**
   * Search query
   */
  query: string;

  /**
   * Search options from @principal-ai/markdown-search
   */
  options?: SearchOptions;

  /**
   * Repository filters
   */
  repositories?: string[];

  /**
   * Additional filters
   */
  filters?: SearchFilters;
}

export interface SearchFilters {
  /**
   * Filter by file paths
   */
  paths?: string[];

  /**
   * Filter by tags
   */
  tags?: string[];

  /**
   * Filter by authors
   */
  authors?: string[];

  /**
   * Date range filter
   */
  dateRange?: {
    from?: Date;
    to?: Date;
  };

  /**
   * Minimum relevance score (0-100)
   */
  minScore?: number;
}

export interface SearchDocumentsResponse {
  /**
   * Search results
   */
  results: SearchResult[];

  /**
   * Total number of results (before pagination)
   */
  total: number;

  /**
   * Search execution time (ms)
   */
  duration: number;

  /**
   * Suggestions for better searches
   */
  suggestions?: string[];
}

/**
 * Get indexing status
 */
export interface GetIndexStatusResponse {
  /**
   * Whether service is initialized
   */
  initialized: boolean;

  /**
   * Whether currently indexing
   */
  isIndexing: boolean;

  /**
   * Indexed repositories
   */
  repositories: RepositoryIndexStatus[];

  /**
   * Total documents across all repos
   */
  totalDocuments: number;

  /**
   * Total index size (bytes)
   */
  indexSize: number;

  /**
   * Last index update time
   */
  lastUpdate?: Date;

  /**
   * Current indexing progress
   */
  progress?: {
    current: number;
    total: number;
    currentFile?: string;
  };
}

export interface RepositoryIndexStatus {
  /**
   * Repository ID
   */
  id: string;

  /**
   * Repository path
   */
  path: string;

  /**
   * Repository name
   */
  name: string;

  /**
   * Number of indexed documents
   */
  documentCount: number;

  /**
   * Last indexed time
   */
  lastIndexed: Date;

  /**
   * Whether file watching is active
   */
  watching: boolean;

  /**
   * Index health status
   */
  status: 'healthy' | 'stale' | 'error';

  /**
   * Error message if status is 'error'
   */
  error?: string;
}

/**
 * Get a specific document
 */
export interface GetDocumentRequest {
  /**
   * Document ID
   */
  id: string;

  /**
   * Include full content
   */
  includeContent?: boolean;
}

export interface GetDocumentResponse {
  /**
   * Document data
   */
  document: SearchResult | null;

  /**
   * Error if failed
   */
  error?: string;
}

// ============================================================================
// Event Types (main -> renderer)
// ============================================================================

/**
 * Index update event
 */
export interface IndexUpdateEvent {
  /**
   * Type of update
   */
  type: 'started' | 'progress' | 'completed' | 'failed';

  /**
   * Repository being indexed
   */
  repository: {
    id: string;
    path: string;
    name: string;
  };

  /**
   * Progress information
   */
  progress?: {
    current: number;
    total: number;
    percentage: number;
    currentFile?: string;
  };

  /**
   * Error if failed
   */
  error?: string;

  /**
   * Statistics for completed indexing
   */
  stats?: {
    documentsIndexed: number;
    documentsFailed: number;
    duration: number;
  };
}

/**
 * Document change event
 */
export interface DocumentChangedEvent {
  /**
   * Type of change
   */
  type: 'added' | 'modified' | 'deleted';

  /**
   * Document that changed
   */
  document: {
    id: string;
    path: string;
    repository: string;
  };

  /**
   * Timestamp of change
   */
  timestamp: Date;
}

/**
 * Index error event
 */
export interface IndexErrorEvent {
  /**
   * Error severity
   */
  severity: 'warning' | 'error' | 'critical';

  /**
   * Error message
   */
  message: string;

  /**
   * Error details
   */
  details?: unknown;

  /**
   * Affected repository
   */
  repository?: {
    id: string;
    path: string;
  };

  /**
   * Affected document
   */
  document?: {
    path: string;
  };

  /**
   * Suggested action
   */
  action?: 'retry' | 'rebuild' | 'ignore';
}

// ============================================================================
// Renderer API Interface
// ============================================================================

/**
 * API exposed to the renderer process
 * This would be implemented via contextBridge
 */
export interface DocumentSearchAPI {
  // Commands
  initialize(options?: InitializeSearchRequest): Promise<void>;
  indexRepository(
    request: IndexRepositoryRequest,
  ): Promise<IndexRepositoryResponse>;
  indexMultipleRepositories(
    repositories: Array<{ path: string; name?: string }>,
  ): Promise<IndexMultipleRepositoriesResponse>;
  removeRepository(id: string): Promise<void>;
  search(request: SearchDocumentsRequest): Promise<SearchDocumentsResponse>;
  getStatus(): Promise<GetIndexStatusResponse>;
  getDocument(request: GetDocumentRequest): Promise<GetDocumentResponse>;
  refreshIndex(repositoryId?: string): Promise<void>;
  clearIndex(): Promise<void>;

  // Event listeners
  onIndexUpdate(callback: (event: IndexUpdateEvent) => void): () => void;
  onDocumentChanged(
    callback: (event: DocumentChangedEvent) => void,
  ): () => void;
  onIndexError(callback: (event: IndexErrorEvent) => void): () => void;
  onSearchReady(callback: () => void): () => void;
  onRepositoryIndexed(
    callback: (repo: RepositoryIndexStatus) => void,
  ): () => void;
}

// ============================================================================
// Type Guards
// ============================================================================

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function isIndexUpdateEvent(event: unknown): event is IndexUpdateEvent {
  if (!isRecord(event)) {
    return false;
  }

  if (
    typeof event.type !== 'string' ||
    !['started', 'progress', 'completed', 'failed'].includes(event.type)
  ) {
    return false;
  }

  const repository = 'repository' in event ? event.repository : undefined;
  if (!isRecord(repository) || typeof repository.id !== 'string') {
    return false;
  }

  return true;
}

export function isDocumentChangedEvent(
  event: unknown,
): event is DocumentChangedEvent {
  if (!isRecord(event)) {
    return false;
  }

  if (
    typeof event.type !== 'string' ||
    !['added', 'modified', 'deleted'].includes(event.type)
  ) {
    return false;
  }

  const document = 'document' in event ? event.document : undefined;
  if (!isRecord(document) || typeof document.id !== 'string') {
    return false;
  }

  return true;
}

export function isIndexErrorEvent(event: unknown): event is IndexErrorEvent {
  if (!isRecord(event)) {
    return false;
  }

  if (
    typeof event.severity !== 'string' ||
    !['warning', 'error', 'critical'].includes(event.severity)
  ) {
    return false;
  }

  return typeof event.message === 'string';
}
