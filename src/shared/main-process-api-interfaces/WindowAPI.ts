/**
 * WindowAPI interface for managing application windows
 * Replaces direct IPC calls to window-related channels
 */

import type { AlexandriaEntry } from '@a24z/core-library';

export interface StoreViewerOptions {
  agent?: string;
  namespace?: string;
}


/**
 * Request to open local files in an editor window
 */
export interface OpenLocalFilesRequest {
  /** Unique identifier for window deduplication */
  windowId: string;
  /** Display title for the window */
  windowTitle?: string;
  /** Files to open with absolute paths */
  files: Array<{
    /** Absolute path to the file on disk */
    path: string;
    /** Optional relative path for display purposes */
    relativePath?: string;
  }>;
}

/**
 * Request to open remote GitHub files in an editor window
 */
export interface OpenRemoteFilesRequest {
  /** Unique identifier for window deduplication */
  windowId: string;
  /** Display title for the window */
  windowTitle?: string;
  /** Files to open with repository-relative paths */
  files: Array<{
    /** Path relative to repository root (e.g., 'src/index.ts') */
    path: string;
  }>;
  /** GitHub repository owner */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** Branch to read from (defaults to main/master) */
  branch?: string;
}

/**
 * Main WindowAPI interface
 */
export interface WindowAPI {
  /**
   * Open Store Viewer window
   * @param options - Optional agent and namespace parameters
   */
  openStoreViewer(options?: StoreViewerOptions): Promise<void>;


  /**
   * Open an editor window for local files
   * @param request - Request containing local file paths and window configuration
   */
  openLocalFiles(request: OpenLocalFilesRequest): Promise<void>;

  /**
   * Open an editor window for remote GitHub files
   * @param request - Request containing repository info and file paths
   */
  openRemoteFiles(request: OpenRemoteFilesRequest): Promise<void>;

  /**
   * Open a markdown viewer window for a single file path.
   * Unlike the dialog-based flow, this accepts a specific absolute file path.
   * @param filePath - Absolute path to the markdown file to open
   * @param projectName - Name of the project/repository this file belongs to
   */
  openMarkdownView(filePath: string, projectName: string): Promise<void>;

  /**
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository entry with path information
   */
  openRepositoryDashboard(repository: AlexandriaEntry): Promise<void>;

  /**
   * Open Pattern Discovery (Callimachus) window
   * Opens a dedicated window for semantic code pattern search and discovery
   */
  openCallimachusWindow(): Promise<void>;
}
