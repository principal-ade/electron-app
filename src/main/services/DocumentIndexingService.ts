/**
 * Document Indexing Service
 *
 * Main process service that handles document indexing using @principal-ai/markdown-search.
 * This service manages the search engine, handles IPC communication, and coordinates
 * document discovery and indexing.
 */

import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  SearchEngine,
  DocumentIndexer,
  FlexSearchAdapter,
  NodeStorageAdapter,
  type SearchOptions,
  type SearchEngineConfig,
  type MarkdownFileProvider,
  type MarkdownFile,
  type FindOptions,
  type FileChange,
} from '@principal-ai/markdown-search';

import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';
import {
  DocumentSearchChannel,
  type SearchDocumentsRequest,
  type SearchDocumentsResponse,
  type GetIndexStatusResponse,
  type GetDocumentRequest,
  type GetDocumentResponse,
  type IndexUpdateEvent,
  type DocumentChangedEvent,
  type IndexErrorEvent,
  type RepositoryIndexStatus,
} from '../../shared/ipc/DocumentSearchIPC';
import type { WorkspaceChangeEventPayload } from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { getManager as getRepositoryMonitoringManager } from '../repository-monitoring/ipcHandlers';

// MonitoringInternalEvent constants (matching the package)
const MonitoringInternalEvent = {
  METRICS_UPDATED: 'metrics-updated',
  GIT_STATUS_CHANGED: 'git-status-changed',
  GIT_STATE_EVENT: 'git-state-event',
  WORKSPACE_CHANGED: 'workspace-changed',
  CACHE_SYNC: 'cache-sync',
  BUILD_ARTIFACTS_DETECTED: 'build-artifacts-detected',
} as const;

// Removed RepositoryInfo interface - no longer tracking individual repositories

export class DocumentIndexingService {
  private searchEngine: SearchEngine | null = null;
  private documentIndexer: DocumentIndexer | null = null;
  private alexandriaRegistry: AlexandriaRegistryService;
  private alexandriaRepositories: Array<{ path: string; name: string }> = [];
  private isInitialized = false;
  private isIndexing = false;
  private lastIndexTime: Date | undefined = undefined;

  // File watching and change tracking
  private pendingChanges = new Map<string, Set<string>>(); // repo path -> set of changed file paths
  private debounceTimers = new Map<string, NodeJS.Timeout>(); // repo path -> timer
  private readonly DEBOUNCE_MS = 2000; // 2 seconds debounce

  // Configuration
  private config = {
    storagePath: '',
    enableWatching: true,
    persistIndex: true,
    maxDocumentsInMemory: 10000,
    autoIndex: true,
  };

  constructor() {
    this.alexandriaRegistry = AlexandriaRegistryService.getInstance();
  }

  /**
   * Initialize the service and register IPC handlers
   */
  async initialize(initConfig?: Partial<typeof this.config>): Promise<void> {
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
      this.config.storagePath = path.join(
        app.getPath('userData'),
        'document-index',
      );
    }

    // Create storage directory if it doesn't exist
    await fs.mkdir(this.config.storagePath, { recursive: true });

    // Initialize search adapter
    const searchAdapter = new FlexSearchAdapter({
      preset: 'performance',
      tokenize: 'forward',
      cache: true,
    });

    // Initialize storage adapter with the correct parameter (just a string path)
    const storageAdapter = new NodeStorageAdapter(
      path.join(this.config.storagePath, 'search-index'),
    );

    // Create a markdown provider that knows about all repositories
    const multiRepoProvider = this.createMultiRepositoryProvider();
    const engineConfig: SearchEngineConfig = {
      storage: storageAdapter,
      markdownProvider: multiRepoProvider,
      searchEngine: searchAdapter,
    };

    this.searchEngine = new SearchEngine(engineConfig);
    await this.searchEngine.initialize();
    this.documentIndexer = new DocumentIndexer();

    // Subscribe to repository monitoring events for file watching
    if (this.config.enableWatching) {
      this.setupRepositoryMonitoring();
    }

    this.isInitialized = true;
  }

  /**
   * Create a markdown provider that scans ALL configured repositories
   */
  private createMultiRepositoryProvider(): MarkdownFileProvider {
    return {
      findMarkdownFiles: async (_options?: FindOptions) => {
        console.log(
          `[DocumentIndexingService] findMarkdownFiles called - scanning ${this.alexandriaRepositories.length} repositories`,
        );
        const allFiles: MarkdownFile[] = [];

        for (const repo of this.alexandriaRepositories) {
          try {
            console.log(
              `[DocumentIndexingService] Scanning repository: ${repo.name} at ${repo.path}`,
            );

            // Use AlexandriaRegistryService to get documents
            const { documents } =
              await this.alexandriaRegistry.getRepositoryDocumentsWithExclusions(
                repo.name,
              );

            console.log(
              `[DocumentIndexingService] Found ${documents.length} files in ${repo.name}`,
            );

            // Convert to MarkdownFile format
            // TODO: Once @principal-ai/markdown-search supports metadata in indexing,
            // we should pass repository metadata here (repository name, path, etc.)
            // See docs/MARKDOWN_SEARCH_FEATURE_REQUEST.md for proposed API
            for (const docPath of documents) {
              const fullPath = path.join(repo.path, docPath);
              allFiles.push({
                path: fullPath,
                name: path.basename(fullPath),
                size: 0, // Will be filled by the library
                modifiedAt: new Date(), // Will be updated by the library
                uri: `file://${fullPath}`,
                // Future: metadata: { repository: repo.name, repositoryPath: repo.path }
              });
            }
          } catch (error) {
            console.error(
              `[DocumentIndexingService] Failed to scan ${repo.name}:`,
              error,
            );
          }
        }

        console.log(
          `[DocumentIndexingService] Total files found across all repositories: ${allFiles.length}`,
        );
        return allFiles;
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
          uri: `file://${filePath}`,
        };
      },

      watchFiles: (_callback: (changes: FileChange[]) => void) => {
        // Return a disposable that does nothing for now
        return { dispose: () => {} };
      },
    };
  }

  /**
   * Setup repository monitoring for real-time file watching
   */
  private setupRepositoryMonitoring(): void {
    try {
      const monitoringManager = getRepositoryMonitoringManager();

      monitoringManager.on(
        MonitoringInternalEvent.WORKSPACE_CHANGED,
        (payload: WorkspaceChangeEventPayload) => {
          this.handleWorkspaceChange(payload);
        },
      );

      console.log(
        '[DocumentIndexingService] Subscribed to repository monitoring events',
      );
    } catch (error) {
      console.error(
        '[DocumentIndexingService] Failed to setup repository monitoring:',
        error,
      );
    }
  }

  /**
   * Handle workspace change events from repository monitoring
   */
  private handleWorkspaceChange(payload: WorkspaceChangeEventPayload): void {
    const { repoPath, changes } = payload;

    // If no changes array, this is likely a git state change without file details
    // We'll do a full refresh in this case (fallback behavior)
    if (!changes || changes.length === 0) {
      console.log(
        `[DocumentIndexingService] Workspace changed for ${repoPath} (no file details, skipping)`,
      );
      return;
    }

    // Filter for markdown files
    const markdownChanges = changes.filter((change) =>
      /\.(md|MD|markdown)$/i.test(change.path),
    );

    if (markdownChanges.length === 0) {
      // No markdown files changed, skip
      return;
    }

    console.log(
      `[DocumentIndexingService] ${markdownChanges.length} markdown file(s) changed in ${repoPath}`,
    );

    // Track changes for this repository
    if (!this.pendingChanges.has(repoPath)) {
      this.pendingChanges.set(repoPath, new Set());
    }

    const repoChanges = this.pendingChanges.get(repoPath);
    if (!repoChanges) {
      console.error(
        `[DocumentIndexingService] Failed to get pending changes for ${repoPath}`,
      );
      return;
    }

    for (const change of markdownChanges) {
      repoChanges.add(change.path);
    }

    // Debounce: clear existing timer and set a new one
    const existingTimer = this.debounceTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.processRepositoryChanges(repoPath);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(repoPath, timer);
  }

  /**
   * Process accumulated changes for a repository after debounce
   */
  private async processRepositoryChanges(repoPath: string): Promise<void> {
    const changes = this.pendingChanges.get(repoPath);
    if (!changes || changes.size === 0) {
      return;
    }

    const changedFiles = Array.from(changes);
    console.log(
      `[DocumentIndexingService] Processing ${changedFiles.length} markdown changes for ${repoPath}`,
    );

    // Clear pending changes
    this.pendingChanges.delete(repoPath);
    this.debounceTimers.delete(repoPath);

    try {
      // For now, do a full re-index of all repositories
      // TODO: In the future, implement incremental updates using searchEngine.updateFiles()
      console.log(
        '[DocumentIndexingService] Triggering full re-index due to markdown changes',
      );
      await this.refreshIndex();

      // Emit document changed events for each file
      for (const filePath of changedFiles) {
        const fullPath = path.join(repoPath, filePath);
        this.sendDocumentChanged({
          type: 'modified', // We don't have fine-grained add/delete info yet
          document: {
            id: fullPath,
            path: fullPath,
            repository: repoPath,
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `[DocumentIndexingService] Failed to process changes for ${repoPath}:`,
        error,
      );
    }
  }

  /**
   * Index all Alexandria repositories
   * This is the ONLY indexing method we need since we always index all repositories together
   */
  public async indexAlexandriaRepositories(
    repositories: Array<{ path: string; name?: string }>,
  ): Promise<{
    totalIndexed: number;
    totalFailed: number;
    results: Array<{
      name: string;
      success: boolean;
      documentsIndexed?: number;
      error?: string;
    }>;
  }> {
    if (!this.isInitialized || !this.searchEngine) {
      throw new Error('Service not initialized');
    }

    // Set the repositories to index
    const reposWithNames = repositories.map((r) => ({
      path: r.path,
      name: r.name || path.basename(r.path),
    }));
    this.alexandriaRepositories = reposWithNames;

    console.log(
      `[DocumentIndexingService] Starting indexing of ${this.alexandriaRepositories.length} Alexandria repositories`,
    );

    const startTime = Date.now();
    try {
      // Use the library's indexFiles method properly
      // It will call our MarkdownFileProvider to get ALL files from ALL repositories
      // and handle the batching internally
      const indexResult = await this.searchEngine.indexFiles({
        onProgress: (progress) => {
          console.log(
            `[DocumentIndexingService] Progress: ${progress.filesProcessed}/${progress.totalFiles} files, phase: ${progress.phase}`,
          );
          this.sendIndexUpdate({
            type: 'progress',
            repository: {
              id: 'all',
              path: 'multiple',
              name: 'All Repositories',
            },
            progress: {
              current: progress.filesProcessed || 0,
              total: progress.totalFiles || 0,
              percentage: progress.percentage || 0,
              currentFile: progress.currentFile,
            },
          });
        },
      });

      const duration = Date.now() - startTime;
      const documentsIndexed = indexResult.documentsIndexed || 0;
      const documentsFailed = indexResult.errors?.length || 0;

      console.log(
        `[DocumentIndexingService] Indexing complete: ${documentsIndexed} documents indexed, ${documentsFailed} failed`,
      );

      // Save the index
      if (this.config.persistIndex) {
        await this.searchEngine.saveIndex();
        console.log('[DocumentIndexingService] Index saved to disk');
      }

      // Update last index time
      this.lastIndexTime = new Date();

      // Send completion event
      this.sendIndexUpdate({
        type: 'completed',
        repository: { id: 'all', path: 'multiple', name: 'All Repositories' },
        stats: {
          documentsIndexed: documentsIndexed,
          documentsFailed: documentsFailed,
          duration,
        },
      });

      return {
        totalIndexed: documentsIndexed,
        totalFailed: documentsFailed,
        results: [
          {
            name: 'All Alexandria Repositories',
            success: true,
            documentsIndexed: documentsIndexed,
          },
        ],
      };
    } catch (error) {
      console.error('[DocumentIndexingService] Indexing failed:', error);

      this.sendIndexUpdate({
        type: 'failed',
        repository: { id: 'all', path: 'multiple', name: 'All Repositories' },
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        totalIndexed: 0,
        totalFailed: 1,
        results: [
          {
            name: 'All Alexandria Repositories',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Backward compatibility wrapper - redirects to indexAlexandriaRepositories
   */
  public async indexMultipleRepositories(
    repositories: Array<{ path: string; name?: string }>,
  ): Promise<{
    totalIndexed: number;
    totalFailed: number;
    results: Array<{
      name: string;
      success: boolean;
      documentsIndexed?: number;
      error?: string;
    }>;
  }> {
    console.log(
      `[DocumentIndexingService] indexMultipleRepositories called - redirecting to indexAlexandriaRepositories`,
    );
    return await this.indexAlexandriaRepositories(repositories);
  }

  /**
   * Refresh the index by re-indexing all Alexandria repositories
   */
  public async refreshIndex(): Promise<void> {
    if (this.alexandriaRepositories.length === 0) {
      console.warn('[DocumentIndexingService] No repositories to refresh');
      return;
    }

    console.log(
      '[DocumentIndexingService] Refreshing index for all Alexandria repositories',
    );
    await this.indexAlexandriaRepositories(this.alexandriaRepositories);
  }

  // Removed setRepositories - repositories are now passed directly to indexAlexandriaRepositories

  // Removed indexRepository - we only index all Alexandria repositories together

  // Removed convertToSearchableDocument - no longer needed

  // Removed getPatternsForFormats - no longer needed

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
  public async searchDocuments(
    request: SearchDocumentsRequest,
  ): Promise<SearchDocumentsResponse> {
    if (!this.searchEngine) {
      throw new Error('Service not initialized');
    }

    const startTime = Date.now();

    try {
      // Perform search
      const searchOptions: SearchOptions = {
        ...request.options,
        limit: request.options?.limit || 100,
      };

      const results = await this.searchEngine.search(
        request.query,
        searchOptions,
      );

      console.log(
        `[DocumentIndexingService] Search for "${request.query}" returned ${results.length} results`,
      );
      if (results.length > 0) {
        console.log(
          `[DocumentIndexingService] First few results:`,
          results.slice(0, 3).map((r) => ({
            path: r.filePath,
            score: r.score,
            title: r.title,
          })),
        );
      }

      // Apply additional filters
      let filtered = results;

      // Apply repository filter if specified
      if (request.repositories && request.repositories.length > 0) {
        const repositories = request.repositories;
        filtered = filtered.filter((result) => {
          // The filePath contains the full path to the document
          // We need to check if it starts with any of the selected repository paths
          return repositories.some((repoPath) =>
            result.filePath.startsWith(repoPath),
          );
        });
      }

      if (request.filters?.minScore !== undefined) {
        const minScore = request.filters.minScore;
        filtered = filtered.filter((r) => r.score >= minScore);
      }

      if (request.filters?.tags) {
        const tags = request.filters.tags;
        filtered = filtered.filter((r) =>
          r.tags?.some((tag) => tags.includes(tag)),
        );
      }

      return {
        results: filtered,
        total: filtered.length,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[DocumentIndexingService] Search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific document
   */
  public async getDocument(
    request: GetDocumentRequest,
  ): Promise<GetDocumentResponse> {
    if (!this.searchEngine) {
      throw new Error('Service not initialized');
    }

    // The new API doesn't have a direct getDocument method
    // We'll need to search for the specific document by ID
    try {
      const results = await this.searchEngine.search(`id:${request.id}`, {
        limit: 1,
      });

      if (results.length > 0) {
        return {
          document: results[0], // Return the full SearchResult directly
        };
      }

      return {
        document: null,
        error: `Document not found: ${request.id}`,
      };
    } catch (error) {
      return {
        document: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get index status
   */
  public async getStatus(): Promise<GetIndexStatusResponse> {
    let totalDocuments = 0;

    // Get document count from search engine if available
    if (this.searchEngine) {
      try {
        const stats = await this.searchEngine.getStats();
        totalDocuments = stats?.totalDocuments || 0;
      } catch (error) {
        console.error('[DocumentIndexingService] Failed to get stats:', error);
      }
    }

    // If we don't have repositories cached, load them from Alexandria
    if (this.alexandriaRepositories.length === 0) {
      try {
        const entries = await this.alexandriaRegistry.getRepositories();
        this.alexandriaRepositories = entries
          .map((entry: AlexandriaEntry) => ({
            path: entry.path || '',
            name: entry.name,
          }))
          .filter((repo) => repo.path); // Filter out entries without valid paths
      } catch (error) {
        console.error(
          '[DocumentIndexingService] Failed to load Alexandria repositories:',
          error,
        );
      }
    }

    // Create simple repository status entries from alexandriaRepositories
    const repositoryStatuses: RepositoryIndexStatus[] =
      this.alexandriaRepositories.map((repo) => ({
        id: repo.path,
        name: repo.name,
        path: repo.path,
        indexed: true,
        documentCount: 0, // We don't track per-repo counts anymore
        lastIndexed: this.lastIndexTime || new Date(),
        watching: false,
        status: 'healthy' as const,
      }));

    return {
      initialized: this.isInitialized,
      isIndexing: this.isIndexing,
      repositories: repositoryStatuses,
      totalDocuments,
      indexSize: 0, // TODO: Calculate actual index size if needed
      lastUpdate: this.lastIndexTime,
      progress: undefined, // Progress is sent via events
    };
  }

  // Removed setupWatcher - file watching not needed for batch indexing

  // Removed handleFileChange - file watching not needed

  // Removed removeRepository - we always index all repositories together

  // Removed removeRepositoryDocuments - not needed

  // Removed removeDocument - not needed

  /**
   * Clear entire index
   */
  public async clearIndex(): Promise<void> {
    if (!this.searchEngine) return;

    // Clear search engine
    await this.searchEngine.clearIndex();

    // Clear Alexandria repositories list
    this.alexandriaRepositories = [];

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
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(DocumentSearchChannel.INDEX_UPDATE, event);
    });
  }

  /**
   * Send document changed event to renderer
   */
  private sendDocumentChanged(event: DocumentChangedEvent): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(DocumentSearchChannel.DOCUMENT_CHANGED, event);
    });
  }

  /**
   * Send index error event to renderer
   */
  private sendIndexError(event: IndexErrorEvent): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(DocumentSearchChannel.INDEX_ERROR, event);
    });
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.pendingChanges.clear();

    // Save index
    if (this.config.persistIndex && this.searchEngine) {
      await this.searchEngine.saveIndex();
    }

    this.isInitialized = false;
  }
}
