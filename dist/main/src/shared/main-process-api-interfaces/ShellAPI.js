export var ShellAPIEvent;
(function (ShellAPIEvent) {
    ShellAPIEvent["OPEN_EXTERNAL"] = "shell:open-external";
    ShellAPIEvent["RUN_COMMAND"] = "shell:run-command";
    ShellAPIEvent["RUN_GREP"] = "shell:run-grep";
    ShellAPIEvent["RUN_BASH_COMMAND"] = "shell:run-bash-command";
    ShellAPIEvent["OPEN_IN_EDITOR"] = "shell:open-in-editor";
    ShellAPIEvent["OPEN_IN_TERMINAL"] = "shell:open-in-terminal";
    ShellAPIEvent["MOVE_TO_TRASH"] = "shell:move-to-trash";
    ShellAPIEvent["OPEN_PATH"] = "shell:openPath";
    ShellAPIEvent["OPEN_TERMINAL"] = "shell:openTerminal";
    ShellAPIEvent["CHECK_COMMAND"] = "terminal:checkCommand";
    ShellAPIEvent["CLEAR_PATH_CACHE"] = "terminal:clearPathCache";
})(ShellAPIEvent || (ShellAPIEvent = {}));
