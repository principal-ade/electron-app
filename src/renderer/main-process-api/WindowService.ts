/**
 * WindowService - Service layer for window management operations
 *
 * This service encapsulates all window.mainProcess.window calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.window MUST be made through this service.
 */

import type {
  StoreViewerOptions,
  OpenLocalFilesRequest,
  OpenRemoteFilesRequest,
} from '../../shared/main-process-api-interfaces/WindowAPI';
import type { AlexandriaEntry } from '@a24z/core-library';

/**
 * Service for managing application windows
 */
export class WindowService {
  /**
   * Open Store Viewer window with optional configuration
   * @param options - Optional agent and namespace parameters
   */
  static async openStoreViewer(options?: StoreViewerOptions): Promise<void> {
    try {
      await window.mainProcess.window.openStoreViewer(options);
    } catch (error) {
      console.error('[WindowService] Failed to open store viewer:', error);
      throw new Error('Failed to open store viewer window');
    }
  }

  /**
   * Open an editor window for local files
   * @param request - Request containing local file paths and window configuration
   */
  static async openLocalFiles(
    request: OpenLocalFilesRequest,
  ): Promise<void> {
    try {
      await window.mainProcess.window.openLocalFiles(request);
    } catch (error) {
      console.error('[WindowService] Failed to open local files:', error);
      throw new Error('Failed to open local files editor window');
    }
  }

  /**
   * Open an editor window for remote GitHub files
   * @param request - Request containing repository info and file paths
   */
  static async openRemoteFiles(
    request: OpenRemoteFilesRequest,
  ): Promise<void> {
    try {
      await window.mainProcess.window.openRemoteFiles(request);
    } catch (error) {
      console.error('[WindowService] Failed to open remote files:', error);
      throw new Error('Failed to open remote files editor window');
    }
  }

  /**
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository from @a24z/core-library package
   */
  static async openRepositoryDashboard(
    repository: AlexandriaEntry,
  ): Promise<void> {
    try {
      await window.mainProcess.window.openRepositoryDashboard(repository);
    } catch (error) {
      console.error(
        '[WindowService] Failed to open repository dashboard:',
        error,
      );
      throw new Error('Failed to open repository dashboard window');
    }
  }
}
