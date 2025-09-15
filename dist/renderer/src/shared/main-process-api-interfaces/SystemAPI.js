export var SystemEvents;
(function (SystemEvents) {
    SystemEvents["GET_PLATFORM"] = "system:get-platform";
    SystemEvents["GET_SYSTEM_INFO"] = "system:get-system-info";
    SystemEvents["EXECUTE_COMMAND"] = "system:execute-command";
    SystemEvents["OPEN_DIALOG"] = "system:open-dialog";
    SystemEvents["CHECK_FOR_UPDATE_MANUALLY"] = "system:check-for-update-manually";
    SystemEvents["RESTART_APP"] = "system:restart-app";
    SystemEvents["UPDATE_CHECK_COMPLETE"] = "system:update-check-complete";
})(SystemEvents || (SystemEvents = {}));
