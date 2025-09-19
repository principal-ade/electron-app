/**
 * WindowAPI interface for managing application windows
 * Replaces direct IPC calls to window-related channels
 */

import type { AlexandriaEntry } from '@a24z/core-library';

export interface StoreViewerOptions {
  agent?: string;
  namespace?: string;
}

export interface MultiFileEditorOptions {
  sessionId: string;
  sessionName?: string;
  files: Array<{
    path: string;
    relativePath?: string;
    lastModified?: number;
  }>;
  repositoryPath: string;
  isRemote?: boolean;
  remoteInfo?: {
    owner: string;
    repo: string;
    branch: string;
  };
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
   * Open Multi-File Editor window
   * @param options - Session and file information
   */
  openMultiFileEditor(options: MultiFileEditorOptions): Promise<void>;

  /**
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository entry with path information
   */
  openRepositoryDashboard(repository: AlexandriaEntry): Promise<void>;
}
