/**
 * Document Search Service (Real Implementation)
 *
 * This service communicates with the main process to perform
 * actual document indexing and search operations.
 */

// Types are defined in shared IPC file to avoid importing Node.js dependencies

import type {
  IndexRepositoryRequest,
  IndexRepositoryResponse,
  SearchDocumentsRequest,
  SearchDocumentsResponse,
  GetIndexStatusResponse,
  IndexUpdateEvent,
  DocumentChangedEvent,
  IndexErrorEvent,
  SearchFilters
} from '../../shared/ipc/DocumentSearchIPC';

import type { SearchResult } from '@a24z/markdown-search';

// Access the API exposed by preload
const searchAPI = window.mainProcess?.documentSearch;

if (!searchAPI) {
  console.error('[DocumentSearchService] Search API not available from preload');
}

export class DocumentSearchService {
  private static instance: DocumentSearchService;
  private initialized = false;
  private eventListeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): DocumentSearchService {
    if (!DocumentSearchService.instance) {
      DocumentSearchService.instance = new DocumentSearchService();
    }
    return DocumentSearchService.instance;
  }

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await searchAPI?.initialize({
        loadPersistedIndex: true,
        config: {
          enableWatching: true,
          autoIndex: true,
          persistIndex: true
        }
      });
      this.initialized = true;
      console.log('[DocumentSearchService] Service initialized');
    } catch (error) {
      console.error('[DocumentSearchService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Index a repository
   */
  async indexRepository(path: string, name?: string): Promise<IndexRepositoryResponse> {
    console.log('[DocumentSearchService] indexRepository called with path:', path, 'name:', name);

    if (!searchAPI) {
      console.error('[DocumentSearchService] Search API not available!');
      throw new Error('Search API not available');
    }

    const request: IndexRepositoryRequest = {
      path,
      name: name || path.split('/').pop() || 'Unknown',
      force: false,
      options: {
        includeDrafts: false
      }
    };

    console.log('[DocumentSearchService] Sending indexRepository request:', request);
    const response = await searchAPI.indexRepository(request);
    console.log('[DocumentSearchService] Received response:', response);
    return response;
  }

  /**
   * Search for documents
   */
  async search(query: string, options?: any): Promise<SearchResult[]> {
    if (!searchAPI) {
      throw new Error('Search API not available');
    }

    const request: SearchDocumentsRequest = {
      query,
      options
    };

    const response = await searchAPI.search(request);
    return response.results;
  }

  /**
   * Get index status
   */
  async getStatus(): Promise<GetIndexStatusResponse> {
    if (!searchAPI) {
      throw new Error('Search API not available');
    }

    return await searchAPI.getStatus();
  }

  /**
   * Remove a repository from the index
   */
  async removeRepository(id: string): Promise<void> {
    if (!searchAPI) {
      throw new Error('Search API not available');
    }

    await searchAPI.removeRepository(id);
  }

  /**
   * Refresh index for a repository
   */
  async refreshIndex(repositoryId?: string): Promise<void> {
    if (!searchAPI) {
      throw new Error('Search API not available');
    }

    await searchAPI.refreshIndex(repositoryId);
  }

  /**
   * Clear entire index
   */
  async clearIndex(): Promise<void> {
    if (!searchAPI) {
      throw new Error('Search API not available');
    }

    await searchAPI.clearIndex();
  }

  /**
   * Subscribe to index updates
   */
  onIndexUpdate(callback: (event: IndexUpdateEvent) => void): () => void {
    if (!searchAPI) {
      console.warn('[DocumentSearchService] Cannot subscribe to events - API not available');
      return () => {};
    }

    const unsubscribe = searchAPI.onIndexUpdate(callback);
    this.eventListeners.add(unsubscribe);

    return () => {
      this.eventListeners.delete(unsubscribe);
      unsubscribe();
    };
  }

  /**
   * Subscribe to document changes
   */
  onDocumentChanged(callback: (event: DocumentChangedEvent) => void): () => void {
    if (!searchAPI) {
      console.warn('[DocumentSearchService] Cannot subscribe to events - API not available');
      return () => {};
    }

    const unsubscribe = searchAPI.onDocumentChanged(callback);
    this.eventListeners.add(unsubscribe);

    return () => {
      this.eventListeners.delete(unsubscribe);
      unsubscribe();
    };
  }

  /**
   * Subscribe to index errors
   */
  onIndexError(callback: (event: IndexErrorEvent) => void): () => void {
    if (!searchAPI) {
      console.warn('[DocumentSearchService] Cannot subscribe to events - API not available');
      return () => {};
    }

    const unsubscribe = searchAPI.onIndexError(callback);
    this.eventListeners.add(unsubscribe);

    return () => {
      this.eventListeners.delete(unsubscribe);
      unsubscribe();
    };
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    this.eventListeners.forEach(unsubscribe => unsubscribe());
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const documentSearchService = DocumentSearchService.getInstance();