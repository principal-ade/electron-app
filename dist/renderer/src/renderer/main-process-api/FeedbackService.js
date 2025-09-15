/**
 * FeedbackService - Service layer for feedback operations
 *
 * This service encapsulates all window.mainProcess.feedback calls to maintain
 * clean architecture and separation of concerns.
 *
 * ALL calls to window.mainProcess.feedback MUST be made through this service.
 */
/**
 * Service for managing feedback operations
 */
export class FeedbackService {
    /**
     * Show context menu for feedback at specified coordinates
     * @param params - Context menu parameters including position and component info
     */
    static async showContextMenu(params) {
        try {
            await window.mainProcess.feedback.showContextMenu(params);
        }
        catch (error) {
            console.error('[FeedbackService] Failed to show context menu:', error);
            throw new Error('Failed to show feedback context menu');
        }
    }
    /**
     * Subscribe to feedback modal show events from the main process
     * @param callback - Function to handle feedback modal events
     * @returns Cleanup function to remove the listener
     */
    static onShowModal(callback) {
        try {
            return window.mainProcess.feedback.onShowModal(callback);
        }
        catch (error) {
            console.error('[FeedbackService] Failed to subscribe to modal events:', error);
            // Return a no-op cleanup function
            return () => { };
        }
    }
    /**
     * Submit component feedback to the backend
     * @param feedbackData - The feedback data to submit
     * @returns Promise resolving to submission result
     */
    static async submitFeedback(feedbackData) {
        try {
            return await window.mainProcess.feedback.submitFeedback(feedbackData);
        }
        catch (error) {
            console.error('[FeedbackService] Failed to submit feedback:', error);
            return { success: false, message: 'Failed to submit feedback' };
        }
    }
}
