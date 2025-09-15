/**
 * Planning IPC channel enums
 * Shared between main and renderer processes
 */
export var PlanningEvent;
(function (PlanningEvent) {
    PlanningEvent["SLIDE_UPDATED"] = "planning:slide-updated";
    PlanningEvent["SLIDE_NAVIGATED"] = "planning:slide-navigated";
    PlanningEvent["DOCUMENT_LOADED"] = "planning:document-loaded";
})(PlanningEvent || (PlanningEvent = {}));
