/**
 * WindowService - Service layer for window management operations
 * 
 * This service encapsulates all window.mainProcess.window calls to maintain
 * clean architecture and separation of concerns.
 * 
 * ALL calls to window.mainProcess.window MUST be made through this service.
 */

import type { StoreViewerOptions, MultiFileEditorOptions } from '../../shared/main-process-api-interfaces/WindowAPI';
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
   * Open Multi-File Editor window for a session
   * @param options - Session and file information
   */
  static async openMultiFileEditor(options: MultiFileEditorOptions): Promise<void> {
    try {
      await window.mainProcess.window.openMultiFileEditor(options);
    } catch (error) {
      console.error('[WindowService] Failed to open multi-file editor:', error);
      throw new Error('Failed to open multi-file editor window');
    }
  }

  /**
   * Open Repository Dashboard for Alexandria repositories
   * @param repository - Alexandria repository from @a24z/core-library package
   */
  static async openRepositoryDashboard(repository: AlexandriaEntry): Promise<void> {
    try {
      await window.mainProcess.window.openRepositoryDashboard(repository);
    } catch (error) {
      console.error('[WindowService] Failed to open repository dashboard:', error);
      throw new Error('Failed to open repository dashboard window');
    }
  }
}