/**
 * IPC Handlers for Document Search
 *
 * Bridges the renderer process to the DocumentIndexingService
 */

import { ipcMain, BrowserWindow } from 'electron';
import { DocumentIndexingService } from '../DocumentIndexingService';
import {
  DocumentSearchChannel,
  InitializeSearchRequest,
  IndexRepositoryRequest,
  SearchDocumentsRequest,
  GetDocumentRequest,
  IndexUpdateEvent,
  DocumentChangedEvent,
  IndexErrorEvent,
  RepositoryIndexStatus
} from '../../../shared/ipc/DocumentSearchIPC';

/**
 * Singleton class for managing Document Search IPC handlers
 */
class DocumentSearchHandlerService {
  private static instance: DocumentSearchHandlerService | null = null;
  private indexingService: DocumentIndexingService | null = null;
  private handlersRegistered = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): DocumentSearchHandlerService {
    if (!DocumentSearchHandlerService.instance) {
      DocumentSearchHandlerService.instance = new DocumentSearchHandlerService();
    }
    return DocumentSearchHandlerService.instance;
  }

  /**
   * Get or create the indexing service instance
   */
  private getIndexingService(): DocumentIndexingService {
    if (!this.indexingService) {
      this.indexingService = new DocumentIndexingService();
    }
    return this.indexingService;
  }

  /**
   * Register all document search IPC handlers
   */
  public registerHandlers(): void {
    // Skip if handlers are already registered
    if (this.handlersRegistered) {
      console.log('[DocumentSearch] IPC handlers already registered, skipping');
      return;
    }

    console.log('[DocumentSearch] Registering IPC handlers');

    // Remove any existing handlers first to avoid conflicts
    try {
      ipcMain.removeHandler(DocumentSearchChannel.INITIALIZE);
      ipcMain.removeHandler(DocumentSearchChannel.INDEX_REPOSITORY);
      ipcMain.removeHandler(DocumentSearchChannel.REMOVE_REPOSITORY);
      ipcMain.removeHandler(DocumentSearchChannel.SEARCH);
      ipcMain.removeHandler(DocumentSearchChannel.GET_STATUS);
      ipcMain.removeHandler(DocumentSearchChannel.GET_DOCUMENT);
      ipcMain.removeHandler(DocumentSearchChannel.REFRESH_INDEX);
      ipcMain.removeHandler(DocumentSearchChannel.CLEAR_INDEX);
    } catch (e) {
      // Ignore errors if handlers don't exist
    }

    // Initialize search service
    ipcMain.handle(DocumentSearchChannel.INITIALIZE, async (_event, request?: InitializeSearchRequest) => {
      const service = this.getIndexingService();
      await service.initialize(request?.config);
      return { success: true };
    });

    // Index a repository
    ipcMain.handle(DocumentSearchChannel.INDEX_REPOSITORY, async (_event, request: IndexRepositoryRequest) => {
      console.log('[DocumentSearchHandlers] INDEX_REPOSITORY handler called with:', request);
      const service = this.getIndexingService();
      const result = await service.indexRepository(request);
      console.log('[DocumentSearchHandlers] Returning result:', result);
      return result;
    });

    // Remove a repository from index
    ipcMain.handle(DocumentSearchChannel.REMOVE_REPOSITORY, async (_event, id: string) => {
      const service = this.getIndexingService();
      await service.removeRepository(id);
      return { success: true };
    });

    // Search documents
    ipcMain.handle(DocumentSearchChannel.SEARCH, async (_event, request: SearchDocumentsRequest) => {
      const service = this.getIndexingService();
      return await service.searchDocuments(request);
    });

    // Get index status
    ipcMain.handle(DocumentSearchChannel.GET_STATUS, async () => {
      const service = this.getIndexingService();
      return await service.getStatus();
    });

    // Get specific document
    ipcMain.handle(DocumentSearchChannel.GET_DOCUMENT, async (_event, request: GetDocumentRequest) => {
      const service = this.getIndexingService();
      return await service.getDocument(request);
    });

    // Refresh index for a repository
    ipcMain.handle(DocumentSearchChannel.REFRESH_INDEX, async (_event, repositoryId?: string) => {
      const service = this.getIndexingService();
      await service.refreshIndex(repositoryId);
      return { success: true };
    });

    // Clear entire index
    ipcMain.handle(DocumentSearchChannel.CLEAR_INDEX, async () => {
      const service = this.getIndexingService();
      await service.clearIndex();
      return { success: true };
    });

    this.handlersRegistered = true;
    console.log('[DocumentSearch] IPC handlers registered successfully');
  }

  /**
   * Send an index update event to all renderer processes
   */
  public sendIndexUpdateEvent(event: IndexUpdateEvent): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.INDEX_UPDATE, event);
    });
  }

  /**
   * Send a document changed event to all renderer processes
   */
  public sendDocumentChangedEvent(event: DocumentChangedEvent): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.DOCUMENT_CHANGED, event);
    });
  }

  /**
   * Send an index error event to all renderer processes
   */
  public sendIndexErrorEvent(event: IndexErrorEvent): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.INDEX_ERROR, event);
    });
  }

  /**
   * Send search ready event to all renderer processes
   */
  public sendSearchReadyEvent(): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.SEARCH_READY);
    });
  }

  /**
   * Send repository indexed event to all renderer processes
   */
  public sendRepositoryIndexedEvent(repo: RepositoryIndexStatus): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.REPOSITORY_INDEXED, repo);
    });
  }

  /**
   * Cleanup function for shutdown
   */
  public shutdown(): void {
    console.log('[DocumentSearch] Shutting down document search service');

    // Remove all handlers
    if (this.handlersRegistered) {
      ipcMain.removeHandler(DocumentSearchChannel.INITIALIZE);
      ipcMain.removeHandler(DocumentSearchChannel.INDEX_REPOSITORY);
      ipcMain.removeHandler(DocumentSearchChannel.REMOVE_REPOSITORY);
      ipcMain.removeHandler(DocumentSearchChannel.SEARCH);
      ipcMain.removeHandler(DocumentSearchChannel.GET_STATUS);
      ipcMain.removeHandler(DocumentSearchChannel.GET_DOCUMENT);
      ipcMain.removeHandler(DocumentSearchChannel.REFRESH_INDEX);
      ipcMain.removeHandler(DocumentSearchChannel.CLEAR_INDEX);
      this.handlersRegistered = false;
    }

    if (this.indexingService) {
      // Any cleanup needed
      this.indexingService = null;
    }
  }
}

// Export singleton instance
const documentSearchHandlerService = DocumentSearchHandlerService.getInstance();

// Export convenience functions for backward compatibility
export function registerDocumentSearchHandlers(): void {
  documentSearchHandlerService.registerHandlers();
}

export function shutdownDocumentSearch(): void {
  documentSearchHandlerService.shutdown();
}

export function sendIndexUpdateEvent(event: IndexUpdateEvent): void {
  documentSearchHandlerService.sendIndexUpdateEvent(event);
}

export function sendDocumentChangedEvent(event: DocumentChangedEvent): void {
  documentSearchHandlerService.sendDocumentChangedEvent(event);
}

export function sendIndexErrorEvent(event: IndexErrorEvent): void {
  documentSearchHandlerService.sendIndexErrorEvent(event);
}

export function sendSearchReadyEvent(): void {
  documentSearchHandlerService.sendSearchReadyEvent();
}

export function sendRepositoryIndexedEvent(repo: RepositoryIndexStatus): void {
  documentSearchHandlerService.sendRepositoryIndexedEvent(repo);
}