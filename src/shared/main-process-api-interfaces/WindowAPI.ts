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

/**
 * Options for opening a dev workspace window
 */
export interface DevWorkspaceOptions {
  /** Full Alexandria entry with repository metadata */
  alexandriaEntry: AlexandriaEntry;
  /**
   * Trail id to auto-open in the trail tab on mount. Forwarded to the
   * renderer via the URL hash (`?openTrailId=`) so the first-render flow
   * can open the tab without depending on persisted "active" state. Only
   * meaningful for freshly-created windows.
   */
  openTrailId?: string;
}

/**
 * Options for opening an Alexandria workspace window
 *
 * Two modes:
 * 1. Workspace mode: Provide workspaceId to open a persisted workspace
 * 2. Thread mode: Provide repositoryPath (without workspaceId) to start an ephemeral thread
 *
 * Thread mode creates a repository-first session that can be expanded with
 * additional repositories and optionally saved as a workspace later.
 */
export interface AlexandriaWorkspaceOptions {
  /** Workspace ID (optional - if not provided, creates ephemeral thread) */
  workspaceId?: string;
  /** Repository path to open/auto-select (required for thread mode) */
  repositoryPath?: string;
  /** Repository ID (PURL or github.id) for identifying the repo (optional) */
  repositoryId?: string;
  /** Additional repository paths to include in the thread (thread mode only) */
  additionalRepositoryPaths?: string[];
  /** Open an empty thread with no initial repositories */
  openEmptyThread?: boolean;
}

/**
 * Options for opening an extension window
 */
export interface ExtensionWindowOptions {
  /** Optional: pre-select a specific panel to display */
  panelId?: string;
}

/**
 * Main WindowAPI interface
 */
export interface WindowAPI {
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
   * Focus a window by its ID
   * @param windowId - The Electron BrowserWindow ID to focus
   * @returns True if the window was found and focused, false otherwise
   */
  focusWindowById(windowId: number): Promise<boolean>;

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

  // Thread operations (ephemeral multi-repository sessions)

  /**
   * Add a repository to the current thread window
   * @param repositoryPath - Path to the repository to add
   * @returns Result indicating success or failure
   */
  addRepositoryToThread(
    repositoryPath: string,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Remove a repository from the current thread window
   * @param repositoryPath - Path to the repository to remove
   * @returns Result indicating success or failure
   */
  removeRepositoryFromThread(
    repositoryPath: string,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Listen for thread repository changes
   * @param callback - Called when repositories are added/removed from the thread
   * @returns Unsubscribe function
   */
  onThreadRepositoriesChanged(
    callback: (event: {
      repositoryPaths: string[];
      addedPath?: string;
      removedPath?: string;
    }) => void,
  ): () => void;

  /**
   * Focus the main window and navigate to the updates settings
   * @returns True if successful, false if failed
   */
  navigateToUpdates(): Promise<boolean>;

  /**
   * Listen for navigate to updates events (used by main window)
   * @param callback - Called when navigation to updates is requested
   * @returns Unsubscribe function
   */
  onNavigateToUpdates(callback: () => void): () => void;
}
