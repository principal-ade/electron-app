/**
 * IPC API interface for Alexandria repository management
 */
export var AlexandriaEventType;
(function (AlexandriaEventType) {
    AlexandriaEventType["ADDED"] = "added";
    AlexandriaEventType["UPDATED"] = "updated";
    AlexandriaEventType["REMOVED"] = "removed";
})(AlexandriaEventType || (AlexandriaEventType = {}));
export var AlexandriaAPIEvent;
(function (AlexandriaAPIEvent) {
    AlexandriaAPIEvent["GET_ALL"] = "alexandria:get-all";
    AlexandriaAPIEvent["GET"] = "alexandria:get";
    AlexandriaAPIEvent["GET_BY_PATH"] = "alexandria:get-by-path";
    AlexandriaAPIEvent["REGISTER"] = "alexandria:register";
    AlexandriaAPIEvent["REMOVE"] = "alexandria:remove";
    AlexandriaAPIEvent["SEARCH"] = "alexandria:search";
    AlexandriaAPIEvent["GET_WITH_VIEWS"] = "alexandria:get-with-views";
    AlexandriaAPIEvent["REFRESH"] = "alexandria:refresh";
    AlexandriaAPIEvent["GET_COUNT"] = "alexandria:get-count";
    AlexandriaAPIEvent["REPOSITORY_ADDED"] = "alexandria:repository-added";
    AlexandriaAPIEvent["REPOSITORY_UPDATED"] = "alexandria:repository-updated";
    AlexandriaAPIEvent["REPOSITORY_REMOVED"] = "alexandria:repository-removed";
})(AlexandriaAPIEvent || (AlexandriaAPIEvent = {}));
