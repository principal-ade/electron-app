/**
 * Window IPC channel enums
 * Shared between main and renderer processes
 */
export var WindowEvent;
(function (WindowEvent) {
    WindowEvent["OPEN_STORE_VIEWER"] = "window:open-store-viewer";
    WindowEvent["OPEN_MULTI_FILE_EDITOR"] = "window:open-multi-file-editor";
    WindowEvent["OPEN_REPOSITORY_DASHBOARD"] = "window:open-repository-dashboard";
    WindowEvent["OPEN_MARKDOWN_FILE_DIALOG"] = "window:open-markdown-file-dialog";
    WindowEvent["OPEN_SESSION_DETAILS"] = "window:open-session-details";
})(WindowEvent || (WindowEvent = {}));
