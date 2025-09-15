/**
 * FeedbackService - Service layer for feedback operations
 *
 * This service encapsulates all window.mainProcess.feedback calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.feedback MUST be made through this service.
 */
import type { ContextMenuParams, FeedbackModalData, FeedbackSubmissionData, FeedbackSubmissionResult } from '../../shared/main-process-api-interfaces/FeedbackAPI';
/**
 * Service for managing feedback operations
 */
export declare class FeedbackService {
    /**
     * Show context menu for feedback at specified coordinates
     * @param params - Context menu parameters including position and component info
     */
    static showContextMenu(params: ContextMenuParams): Promise<void>;
    /**
     * Subscribe to feedback modal show events from the main process
     * @param callback - Function to handle feedback modal events
     * @returns Cleanup function to remove the listener
     */
    static onShowModal(callback: (data: FeedbackModalData) => void): () => void;
    /**
     * Submit component feedback to the backend
     * @param feedbackData - The feedback data to submit
     * @returns Promise resolving to submission result
     */
    static submitFeedback(feedbackData: FeedbackSubmissionData): Promise<FeedbackSubmissionResult>;
}
//# sourceMappingURL=FeedbackService.d.ts.map