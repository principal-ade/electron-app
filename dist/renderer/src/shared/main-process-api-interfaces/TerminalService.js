export var TerminalAPIEvents;
(function (TerminalAPIEvents) {
    TerminalAPIEvents["CREATE"] = "terminal:create";
    TerminalAPIEvents["GET_OR_CREATE"] = "terminal:getOrCreate";
    TerminalAPIEvents["CREATE_WITH_COMMAND"] = "terminal:create-with-command";
    TerminalAPIEvents["WRITE"] = "terminal:write";
    TerminalAPIEvents["RESIZE"] = "terminal:resize";
    TerminalAPIEvents["DESTROY"] = "terminal:destroy";
    TerminalAPIEvents["LIST"] = "terminal:list";
    TerminalAPIEvents["POP_OUT"] = "terminal:popOut";
    TerminalAPIEvents["FOCUS_WINDOW"] = "terminal:focusWindow";
    TerminalAPIEvents["REFRESH"] = "terminal:refresh";
    TerminalAPIEvents["ON_DATA"] = "terminal:data";
    TerminalAPIEvents["ON_EXIT"] = "terminal:exit";
    TerminalAPIEvents["ON_WINDOW_READY"] = "terminal:window-ready";
    TerminalAPIEvents["CHECK_COMMAND"] = "terminal:checkCommand";
    TerminalAPIEvents["CLEAR_PATH_CACHE"] = "terminal:clearPathCache";
})(TerminalAPIEvents || (TerminalAPIEvents = {}));
