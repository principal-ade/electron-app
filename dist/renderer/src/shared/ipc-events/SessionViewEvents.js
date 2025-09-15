/**
 * Session View IPC channel enums
 * Shared between main and renderer processes
 */
export var SessionViewEvent;
(function (SessionViewEvent) {
    SessionViewEvent["GET_VIEW"] = "session-view:get-view";
    SessionViewEvent["GET_SEGMENT"] = "session-view:get-segment";
    SessionViewEvent["GET_STATISTICS"] = "session-view:get-statistics";
})(SessionViewEvent || (SessionViewEvent = {}));
