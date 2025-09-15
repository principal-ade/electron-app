/**
 * Feedback IPC channel enums
 * Shared between main and renderer processes
 */
export var FeedbackEvent;
(function (FeedbackEvent) {
    FeedbackEvent["SHOW_CONTEXT_MENU"] = "show-feedback-context-menu";
    FeedbackEvent["SHOW_MODAL"] = "show-feedback-modal";
    FeedbackEvent["SUBMIT_FEEDBACK"] = "submit-component-feedback";
})(FeedbackEvent || (FeedbackEvent = {}));
