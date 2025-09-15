/**
 * Feedback IPC channel enums
 * Shared between main and renderer processes
 */

export enum FeedbackEvent {
  SHOW_CONTEXT_MENU = 'show-feedback-context-menu',
  SHOW_MODAL = 'show-feedback-modal',
  SUBMIT_FEEDBACK = 'submit-component-feedback',
}