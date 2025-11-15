/**
 * WindowAPI interface for managing application windows
 * Replaces direct IPC calls to window-related channels
 */

import type { AlexandriaEntry } from '@a24z/core-library';

/**
 * Repository window state
 */
export interface RepositoryWindowState {
  remoteUrl: string;
  state: 'opening' | 'ready';
}

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
   * @param options - Optional configuration for the markdown viewer
   */
  openMarkdownView(
    filePath: string,
    projectName: string,
    options?: { viewMode?: 'single' | 'book' },
  ): Promise<void>;

  /**
   * Open a markdown viewer window with a relative file path
   * The main process will resolve the relative path against the repository path
   * @param relativeFilePath - Path to the markdown file relative to the repository
   * @param repositoryPath - Absolute path to the repository
   * @param options - Optional configuration for the markdown viewer
   */
  openMarkdownViewFromRepository(
    relativeFilePath: string,
    repositoryPath: string,
    options?: { viewMode?: 'single' | 'book' },
  ): Promise<void>;

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

  /**
   * Open Alexandria Workspace window for a specific workspace
   * Opens a dedicated window for managing a single workspace and its repository members
   * @param workspaceId - The ID of the workspace to open
   */
  openAlexandriaWorkspace(workspaceId: string): Promise<void>;

  /**
   * Get the unique ID of the current window
   * Useful for isolating resources (like terminal sessions) per window
   * @returns The Electron BrowserWindow ID
   */
  getWindowId(): Promise<number>;

  /**
   * Check if a repository window is already open
   * @param repository - Alexandria repository entry to check
   * @returns True if the repository window is open, false otherwise
   */
  isRepositoryWindowOpen(repository: AlexandriaEntry): Promise<boolean>;

  /**
   * Listen for repository windows state changes
   * @param callback - Called with array of repository window states when state changes
   */
  onRepositoryWindowsChanged(
    callback: (repoWindows: RepositoryWindowState[]) => void,
  ): void;
}
