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
export declare class WindowService {
    /**
     * Open Store Viewer window with optional configuration
     * @param options - Optional agent and namespace parameters
     */
    static openStoreViewer(options?: StoreViewerOptions): Promise<void>;
    /**
     * Open Multi-File Editor window for a session
     * @param options - Session and file information
     */
    static openMultiFileEditor(options: MultiFileEditorOptions): Promise<void>;
    /**
     * Open Repository Dashboard for Alexandria repositories
     * @param repository - Alexandria repository from @a24z/core-library package
     */
    static openRepositoryDashboard(repository: AlexandriaEntry): Promise<void>;
}
//# sourceMappingURL=WindowService.d.ts.map