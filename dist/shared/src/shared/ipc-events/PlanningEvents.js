/**
 * Planning IPC channel enums
 * Shared between main and renderer processes
 */
export var PlanningEvent;
(function (PlanningEvent) {
    PlanningEvent["SLIDE_UPDATED"] = "planning:slide-updated";
    PlanningEvent["SLIDE_NAVIGATED"] = "planning:slide-navigated";
    PlanningEvent["DOCUMENT_LOADED"] = "planning:document-loaded";
    PlanningEvent["AGENT_DOCUMENT_REQUEST"] = "planning:agent-document-request";
    PlanningEvent["AGENT_DOCUMENT_RESPONSE"] = "planning:agent-document-response";
})(PlanningEvent || (PlanningEvent = {}));
