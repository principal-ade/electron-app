/**
 * FeedbackAPI preload implementation
 * Provides type-safe access to feedback operations
 */
import { ipcRenderer } from 'electron';
import { FeedbackEvent } from '../../shared/ipc-events/FeedbackEvents';
/**
 * Feedback API implementation for preload script
 */
export const feedbackAPI = {
    /**
     * Show context menu for feedback at specified coordinates
     */
    showContextMenu: async (params) => {
        ipcRenderer.send(FeedbackEvent.SHOW_CONTEXT_MENU, params);
    },
    /**
     * Listen for feedback modal show events
     */
    onShowModal: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on(FeedbackEvent.SHOW_MODAL, subscription);
        return () => ipcRenderer.removeListener(FeedbackEvent.SHOW_MODAL, subscription);
    },
    /**
     * Submit component feedback to the backend
     */
    submitFeedback: (feedbackData) => ipcRenderer.invoke(FeedbackEvent.SUBMIT_FEEDBACK, feedbackData),
};
