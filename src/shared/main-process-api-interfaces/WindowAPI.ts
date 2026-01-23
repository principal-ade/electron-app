/**
 * WindowAPI interface for managing application windows
 * Replaces direct IPC calls to window-related channels
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

/**
 * Repository window state
 */
export interface RepositoryWindowState {
  remoteUrl: string;
  /** Local path for dev-workspace windows */
  localPath?: string;
  state: 'opening' | 'ready';
}

export interface StoreViewerOptions {
  agent?: string;
  namespace?: string;
}

/**
 * Options for opening a dev workspace window
 */
export interface DevWorkspaceOptions {
  /** Full Alexandria entry with repository metadata */
  alexandriaEntry: AlexandriaEntry;
}

/**
 * Options for opening an Alexandria workspace window
 */
export interface AlexandriaWorkspaceOptions {
  /** Workspace ID (optional - if not provided, creates temp workspace) */
  workspaceId?: string;
  /** Repository path to auto-select (optional) */
  repositoryPath?: string;
  /** Repository ID (PURL or github.id) for identifying the repo (optional) */
  repositoryId?: string;
}

/**
 * Options for opening an extension window
 */
export interface ExtensionWindowOptions {
  /** Optional: pre-select a specific panel to display */
  panelId?: string;
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
   * Open Pattern Discovery (Callimachus) window
   * Opens a dedicated window for semantic code pattern search and discovery
   */
  openCallimachusWindow(): Promise<void>;

  /**
   * Open Alexandria Workspace window
   * Opens a dedicated window for managing a workspace and its repository members
   * Can open with a specific workspace, or create a temporary workspace for a single repository
   * @param options - Options for opening the workspace (workspaceId, repositoryPath, etc.)
   */
  openAlexandriaWorkspace(options: AlexandriaWorkspaceOptions): Promise<void>;

  /**
   * Focus the main window if it exists, otherwise create it
   * This is useful for "new window" operations that should show the main window
   * @returns True if successful, false if failed
   */
  focusOrCreateMainWindow(): Promise<boolean>;

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

  /**
   * Open a dev workspace window with the panel framework
   * @param options - Repository path and name
   * @returns Window ID if successful, null otherwise
   */
  openDevWorkspace(
    options: DevWorkspaceOptions,
  ): Promise<{ windowId: number } | null>;

  /**
   * Open the extension browser window
   * @param options - Optional configuration
   * @returns Window ID if successful, null otherwise
   */
  openExtensionWindow(
    options?: ExtensionWindowOptions,
  ): Promise<{ windowId: number } | null>;
}
