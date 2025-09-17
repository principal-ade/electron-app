/**
 * Document Indexing Service
 *
 * Main process service that handles document indexing using @a24z/markdown-search.
 * This service manages the search engine, handles IPC communication, and coordinates
 * document discovery and indexing.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import chokidar, { FSWatcher } from 'chokidar';
import {
  SearchEngine,
  DocumentIndexer,
  FlexSearchAdapter,
  NodeStorageAdapter,
  type SearchableDocument,
  type SearchResult,
  type SearchOptions,
  type IndexingProgress,
  type SearchEngineConfig,
  type MarkdownFileProvider,
  type MarkdownFile,
  type FindOptions,
  type FileChange
} from '@a24z/markdown-search';

import { InterimDocumentScanner } from './InterimDocumentScanner';
import type { IndexableDocument } from '../../shared/types/document-discovery.types';
import {
  DocumentSearchChannel,
  type InitializeSearchRequest,
  type IndexRepositoryRequest,
  type IndexRepositoryResponse,
  type SearchDocumentsRequest,
  type SearchDocumentsResponse,
  type GetIndexStatusResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type IndexUpdateEvent,
  type DocumentChangedEvent,
  type IndexErrorEvent,
  type RepositoryIndexStatus
} from '../../shared/ipc/DocumentSearchIPC';

interface RepositoryInfo {
  id: string;
  path: string;
  name: string;
  watcher?: FSWatcher;
  documentCount: number;
  lastIndexed: Date;
  status: 'healthy' | 'stale' | 'error';
  error?: string;
}

export class DocumentIndexingService {
  private searchEngine: SearchEngine | null = null;
  private documentIndexer: DocumentIndexer | null = null;
  private scanner: InterimDocumentScanner;
  private repositories: Map<string, RepositoryInfo> = new Map();
  private isInitialized = false;
  private isIndexing = false;
  private currentIndexingRepo: string | null = null;
  private indexingProgress: IndexingProgress | null = null;

  // Configuration
  private config = {
    storagePath: '',
    enableWatching: true,
    persistIndex: true,
    maxDocumentsInMemory: 10000,
    autoIndex: true
  };

  constructor() {
    this.scanner = new InterimDocumentScanner();
  }

  /**
   * Initialize the service and register IPC handlers
   */
  async initialize(initConfig?: any): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Merge config if provided
    if (initConfig) {
      Object.assign(this.config, initConfig);
    }

    // Set default storage path if not specified
    if (!this.config.storagePath) {
      const { app } = require('electron');
      this.config.storagePath = path.join(app.getPath('userData'), 'document-index');
    }


    // Create storage directory if it doesn't exist
    await fs.mkdir(this.config.storagePath, { recursive: true });

    // Initialize search adapter
    const searchAdapter = new FlexSearchAdapter({
      preset: 'performance',
      tokenize: 'forward',
      cache: true
    });

    // Initialize storage adapter with the correct parameter (just a string path)
    const storageAdapter = new NodeStorageAdapter(
      path.join(this.config.storagePath, 'search-index')
    );

    // Create a markdown provider implementation
    const markdownProvider: MarkdownFileProvider = {
      findMarkdownFiles: async (_options?: FindOptions) => {
        // Use the InterimDocumentScanner to find files
        const scanner = new InterimDocumentScanner();
        const basePath = process.cwd();
        const docs = await scanner.scanRepository(basePath, {
          formats: ['markdown', 'mdx']
        });

        // Convert to MarkdownFile format expected by the library
        return docs.map(doc => ({
          path: doc.path,
          name: path.basename(doc.path),
          size: 0, // Will be filled by the library
          modifiedAt: doc.metadata?.lastModified || new Date(),
          uri: `file://${doc.path}`
        }));
      },
      readMarkdownFile: async (filePath: string): Promise<string> => {
        return await fs.readFile(filePath, 'utf-8');
      },
      getFileInfo: async (filePath: string): Promise<MarkdownFile> => {
        const stats = await fs.stat(filePath);
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          modifiedAt: stats.mtime,
          uri: `file://${filePath}`
        };
      },
      watchFiles: (callback: (changes: FileChange[]) => void) => {
        // Return a disposable that does nothing for now
        return { dispose: () => {} };
      }
    };

    // Initialize search engine with correct config
    const engineConfig: SearchEngineConfig = {
      storage: storageAdapter,
      markdownProvider: markdownProvider,
      searchEngine: searchAdapter
    };

    this.searchEngine = new SearchEngine(engineConfig);

    // Initialize the search engine
    await this.searchEngine.initialize();

    // DocumentIndexer doesn't need any parameters
    this.documentIndexer = new DocumentIndexer();

    // Check if index exists and has data
    if (this.config.persistIndex) {
      try {
        const hasIndex = await this.searchEngine.hasIndex();
        if (!hasIndex && this.config.autoIndex) {
          const currentPath = process.cwd();

          // Only auto-index if we're in a valid project directory
          if (currentPath && !currentPath.includes('node_modules')) {
            setTimeout(async () => {
              try {
                await this.indexRepository({
                  path: currentPath,
                  name: path.basename(currentPath),
                  force: false
                });
              } catch (error) {
                console.error('Auto-index failed:', error);
              }
            }, 2000); // Small delay to let everything initialize
          }
        }
      } catch (error) {
        console.error('Error checking for persisted index:', error);
      }
    }

    // IPC handlers are registered externally via documentSearchHandlers.ts
    // to avoid duplicate registration issues

    this.isInitialized = true;
  }

  /**
   * Refresh index for one or all repositories
   */
  public async refreshIndex(repositoryId?: string): Promise<void> {
    if (repositoryId) {
      const repo = this.repositories.get(repositoryId);
      if (repo) {
        await this.indexRepository({
          path: repo.path,
          id: repo.id,
          name: repo.name,
          force: true
        });
      }
    } else {
      // Refresh all repositories
      for (const repo of this.repositories.values()) {
        await this.indexRepository({
          path: repo.path,
          id: repo.id,
          name: repo.name,
          force: true
        });
      }
    }
  }

  /**
   * Index a repository
   */
  public async indexRepository(request: IndexRepositoryRequest): Promise<IndexRepositoryResponse> {
    if (!this.searchEngine || !this.documentIndexer) {
      throw new Error('Service not initialized');
    }

    const startTime = Date.now();
    const repoId = request.id || request.path;
    const repoName = request.name || path.basename(request.path);

    // Check if already indexing
    if (this.isIndexing) {
      return {
        success: false,
        documentsIndexed: 0,
        documentsFailed: 0,
        duration: 0,
        error: 'Another indexing operation is in progress'
      };
    }

    this.isIndexing = true;
    this.currentIndexingRepo = repoId;

    // Send indexing started event
    this.sendIndexUpdate({
      type: 'started',
      repository: { id: repoId, path: request.path, name: repoName }
    });

    try {
      // Remove old index if force refresh
      if (request.force && this.repositories.has(repoId)) {
        await this.removeRepositoryDocuments(repoId);
      }

      // Use the search engine's built-in file indexing
      const indexResult = await this.searchEngine.indexFiles({
        patterns: ['**/*.md', '**/*.mdx'],
        onProgress: (progress) => {
          this.sendIndexUpdate({
            type: 'progress',
            repository: { id: repoId, path: request.path, name: repoName },
            progress: {
              current: progress.filesProcessed || 0,
              total: progress.totalFiles || 0,
              percentage: progress.filesProcessed && progress.totalFiles ?
                Math.round((progress.filesProcessed / progress.totalFiles) * 100) : 0,
              currentFile: progress.currentFile
            }
          });
        }
      });

      const indexed = indexResult.filesIndexed;
      const failed = indexResult.errors?.length || 0;
      const failures = indexResult.errors?.map(e => ({
        path: e.file,
        error: e.error
      })) || [];

      // Set up file watcher
      if (this.config.enableWatching) {
        await this.setupWatcher(repoId, request.path);
      }

      // Update repository info
      this.repositories.set(repoId, {
        id: repoId,
        path: request.path,
        name: repoName,
        documentCount: indexed,
        lastIndexed: new Date(),
        status: 'healthy'
      });

      // Persist index
      if (this.config.persistIndex) {
        await this.searchEngine.saveIndex();
      }

      const duration = Date.now() - startTime;

      // Send completion event
      this.sendIndexUpdate({
        type: 'completed',
        repository: { id: repoId, path: request.path, name: repoName },
        stats: {
          documentsIndexed: indexed,
          documentsFailed: failed,
          duration
        }
      });

      return {
        success: true,
        documentsIndexed: indexed,
        documentsFailed: failed,
        duration,
        failures: failures.length > 0 ? failures : undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Send error event
      this.sendIndexUpdate({
        type: 'failed',
        repository: { id: repoId, path: request.path, name: repoName },
        error: errorMessage
      });

      return {
        success: false,
        documentsIndexed: 0,
        documentsFailed: 0,
        duration: Date.now() - startTime,
        error: errorMessage
      };
    } finally {
      this.isIndexing = false;
      this.currentIndexingRepo = null;
    }
  }

  /**
   * Convert IndexableDocument to SearchableDocument
   */
  private async convertToSearchableDocument(
    doc: IndexableDocument,
    repoId: string
  ): Promise<SearchableDocument> {
    // Read file content
    const content = await fs.readFile(doc.path, 'utf-8');

    return {
      id: `${repoId}:${doc.relativePath}`,
      type: 'document',
      fileUri: `file://${doc.path}`,
      fileName: path.basename(doc.path),
      filePath: doc.path,
      content,
      title: doc.metadata?.title,
      metadata: {
        wordCount: doc.metadata?.wordCount,
        hasCode: content.includes('```'),
        codeLanguages: this.extractCodeLanguages(content),
        hasMermaid: content.includes('```mermaid'),
        hasTables: content.includes('|'),
        hasImages: content.includes('!['),
        hasLinks: content.includes('['),
        linkCount: (content.match(/\[.*?\]\(.*?\)/g) || []).length,
        ...doc.metadata?.custom
      },
      tags: doc.metadata?.tags,
      indexedAt: new Date().toISOString()
    };
  }

  /**
   * Get glob patterns for specific formats
   */
  private getPatternsForFormats(formats: string[]): string[] {
    const patterns: string[] = [];
    for (const format of formats) {
      switch (format) {
        case 'markdown':
          patterns.push('**/*.md');
          break;
        case 'mdx':
          patterns.push('**/*.mdx');
          break;
        default:
          patterns.push(`**/*.${format}`);
      }
    }
    return patterns.length > 0 ? patterns : ['**/*.md', '**/*.mdx'];
  }

  /**
   * Extract code languages from markdown content
   */
  private extractCodeLanguages(content: string): string[] {
    const languages = new Set<string>();
    const codeBlockRegex = /```(\w+)/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match[1]) {
        languages.add(match[1]);
      }
    }

    return Array.from(languages);
  }

  /**
   * Search for documents
   */
  public async searchDocuments(request: SearchDocumentsRequest): Promise<SearchDocumentsResponse> {
    if (!this.searchEngine) {
      throw new Error('Service not initialized');
    }

    const startTime = Date.now();

    try {
      // Perform search
      const searchOptions: SearchOptions = {
        ...request.options,
        limit: request.options?.limit || 100
      };

      const results = await this.searchEngine.search(request.query, searchOptions);

      // Apply additional filters
      let filtered = results;

      // Apply repository filter if specified
      if (request.repositories && request.repositories.length > 0) {
        filtered = filtered.filter(result => {
          const [repoId] = result.id.split(':');
          return request.repositories!.includes(repoId);
        });
      }

      if (request.filters?.minScore) {
        filtered = filtered.filter(r => r.score >= request.filters!.minScore!);
      }

      if (request.filters?.tags) {
        filtered = filtered.filter(r =>
          r.tags?.some(tag => request.filters!.tags!.includes(tag))
        );
      }

      return {
        results: filtered,
        total: filtered.length,
        duration: Date.now() - startTime
      };
    } catch (error) {
      console.error('[DocumentIndexingService] Search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific document
   */
  public async getDocument(request: GetDocumentRequest): Promise<GetDocumentResponse> {
    if (!this.searchEngine) {
      throw new Error('Service not initialized');
    }

    // The new API doesn't have a direct getDocument method
    // We'll need to search for the specific document by ID
    try {
      const results = await this.searchEngine.search(`id:${request.id}`, {
        limit: 1
      });

      if (results.length > 0) {
        return {
          document: {
            id: results[0].id,
            content: results[0].content,
            title: results[0].title,
            path: results[0].path,
            metadata: results[0].metadata,
            type: results[0].type
          }
        };
      }

      return {
        document: null,
        error: `Document not found: ${request.id}`
      };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get index status
   */
  public getStatus(): GetIndexStatusResponse {

    const repositories: RepositoryIndexStatus[] = Array.from(this.repositories.values()).map(repo => ({
      id: repo.id,
      path: repo.path,
      name: repo.name,
      documentCount: repo.documentCount,
      lastIndexed: repo.lastIndexed,
      watching: !!repo.watcher,
      status: repo.status,
      error: repo.error
    }));

    const totalDocuments = repositories.reduce((sum, r) => sum + r.documentCount, 0);

    return {
      initialized: this.isInitialized,
      isIndexing: this.isIndexing,
      repositories,
      totalDocuments,
      indexSize: 0, // TODO: Calculate actual index size
      lastUpdate: repositories.length > 0
        ? repositories.reduce((latest, r) =>
            r.lastIndexed > latest ? r.lastIndexed : latest,
            repositories[0].lastIndexed
          )
        : undefined,
      progress: this.isIndexing && this.indexingProgress
        ? {
            current: this.indexingProgress.processed,
            total: this.indexingProgress.total,
            currentFile: this.indexingProgress.currentFile
          }
        : undefined
    };
  }

  /**
   * Setup file watcher for a repository
   */
  private async setupWatcher(repoId: string, repoPath: string): Promise<void> {
    // Remove existing watcher if any
    const repo = this.repositories.get(repoId);
    if (repo?.watcher) {
      await repo.watcher.close();
    }

    const patterns = this.scanner.getWatchPatterns(repoPath);
    const watcher = chokidar.watch(patterns, {
      cwd: repoPath,
      ignored: ['**/node_modules/**', '**/.git/**'],
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', async (filePath) => {
      await this.handleFileChange(repoId, path.join(repoPath, filePath), 'modified');
    });

    watcher.on('add', async (filePath) => {
      await this.handleFileChange(repoId, path.join(repoPath, filePath), 'added');
    });

    watcher.on('unlink', async (filePath) => {
      await this.handleFileChange(repoId, path.join(repoPath, filePath), 'deleted');
    });

    // Update repository info
    const repoInfo = this.repositories.get(repoId);
    if (repoInfo) {
      repoInfo.watcher = watcher;
      this.repositories.set(repoId, repoInfo);
    }
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(
    repoId: string,
    filePath: string,
    type: 'added' | 'modified' | 'deleted'
  ): Promise<void> {

    // Send document changed event
    const event: DocumentChangedEvent = {
      type,
      document: {
        id: `${repoId}:${path.relative(this.repositories.get(repoId)!.path, filePath)}`,
        path: filePath,
        repository: repoId
      },
      timestamp: new Date()
    };

    this.sendDocumentChanged(event);

    // Re-index the document
    if (type === 'deleted') {
      await this.removeDocument(event.document.id);
    } else {
      // Re-index the single document
      // TODO: Implement single document indexing
    }
  }

  /**
   * Remove a repository and its documents
   */
  public async removeRepository(id: string): Promise<void> {
    const repo = this.repositories.get(id);
    if (!repo) return;

    // Close watcher
    if (repo.watcher) {
      await repo.watcher.close();
    }

    // Remove documents from index
    await this.removeRepositoryDocuments(id);

    // Remove from map
    this.repositories.delete(id);

    // Persist changes
    if (this.config.persistIndex && this.searchEngine) {
      await this.searchEngine.saveIndex();
    }
  }

  /**
   * Remove all documents from a repository
   */
  private async removeRepositoryDocuments(repoId: string): Promise<void> {
    // TODO: Implement batch document removal
  }

  /**
   * Remove a single document
   */
  private async removeDocument(docId: string): Promise<void> {
    if (!this.searchEngine) return;

    // TODO: Implement document removal in search engine
  }

  /**
   * Clear entire index
   */
  public async clearIndex(): Promise<void> {
    if (!this.searchEngine) return;

    // Clear all repositories
    for (const repo of this.repositories.values()) {
      if (repo.watcher) {
        await repo.watcher.close();
      }
    }
    this.repositories.clear();

    // Clear search engine
    await this.searchEngine.clearIndex();

    // Persist empty index
    if (this.config.persistIndex) {
      await this.searchEngine.saveIndex();
    }
  }

  /**
   * Send index update event to renderer
   */
  private sendIndexUpdate(event: IndexUpdateEvent): void {
    // Send to all renderer windows
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.INDEX_UPDATE, event);
    });
  }

  /**
   * Send document changed event to renderer
   */
  private sendDocumentChanged(event: DocumentChangedEvent): void {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.DOCUMENT_CHANGED, event);
    });
  }

  /**
   * Send index error event to renderer
   */
  private sendIndexError(event: IndexErrorEvent): void {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(DocumentSearchChannel.INDEX_ERROR, event);
    });
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {

    // Close all watchers
    for (const repo of this.repositories.values()) {
      if (repo.watcher) {
        await repo.watcher.close();
      }
    }

    // Save index
    if (this.config.persistIndex && this.searchEngine) {
      await this.searchEngine.saveIndex();
    }

    this.isInitialized = false;
  }
}