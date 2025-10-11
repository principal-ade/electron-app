/**
 * FeedbackAPI preload implementation
 * Provides type-safe access to feedback operations
 */

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  FeedbackAPI,
  ContextMenuParams,
  FeedbackModalData,
  FeedbackSubmissionData,
  FeedbackSubmissionResult,
} from '../../shared/main-process-api-interfaces/FeedbackAPI';
import { FeedbackEvent } from '../../shared/ipc-events/FeedbackEvents';

/**
 * Feedback API implementation for preload script
 */
export const feedbackAPI: FeedbackAPI = {
  /**
   * Show context menu for feedback at specified coordinates
   */
  showContextMenu: async (params: ContextMenuParams) => {
    ipcRenderer.send(FeedbackEvent.SHOW_CONTEXT_MENU, params);
  },

  /**
   * Listen for feedback modal show events
   */
  onShowModal: (callback: (data: FeedbackModalData) => void) => {
    const subscription = (_event: IpcRendererEvent, data: FeedbackModalData) =>
      callback(data);
    ipcRenderer.on(FeedbackEvent.SHOW_MODAL, subscription);
    return () =>
      ipcRenderer.removeListener(FeedbackEvent.SHOW_MODAL, subscription);
  },

  /**
   * Submit component feedback to the backend
   */
  submitFeedback: (
    feedbackData: FeedbackSubmissionData,
  ): Promise<FeedbackSubmissionResult> =>
    ipcRenderer.invoke(FeedbackEvent.SUBMIT_FEEDBACK, feedbackData),
};
