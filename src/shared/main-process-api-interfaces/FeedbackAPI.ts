/**
 * FeedbackAPI interface for managing feedback context menus and modals
 * Replaces direct IPC calls for feedback-related channels
 */

export interface ContextMenuParams {
  x: number;
  y: number;
  componentName?: string;
  componentPath?: string;
  elementInfo?: string;
}

export interface FeedbackModalData {
  componentName: string;
  componentPath: string;
  elementInfo: string;
  screenshot?: string;
  additionalData?: Record<string, unknown>;
}

export interface FeedbackSubmissionData {
  componentName: string;
  componentPath: string;
  elementInfo: string;
  feedbackText: string;
  feedbackType: 'bug' | 'feature' | 'improvement' | 'other';
  screenshot?: string;
  additionalData?: Record<string, unknown>;
}

export interface FeedbackSubmissionResult {
  success: boolean;
  message: string;
}

/**
 * Main FeedbackAPI interface
 */
export interface FeedbackAPI {
  /**
   * Show context menu for feedback at specified coordinates
   * @param params - Context menu parameters including position and component info
   */
  showContextMenu(params: ContextMenuParams): Promise<void>;

  /**
   * Listen for feedback modal show events from the main process
   * @param callback - Function to handle feedback modal events
   * @returns Cleanup function to remove the listener
   */
  onShowModal(callback: (data: FeedbackModalData) => void): () => void;

  /**
   * Submit component feedback to the backend
   * @param feedbackData - The feedback data to submit
   * @returns Promise resolving to submission result
   */
  submitFeedback(
    feedbackData: FeedbackSubmissionData,
  ): Promise<FeedbackSubmissionResult>;
}
