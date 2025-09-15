export const shell = {
    openExternal: async (url) => {
        if (window.mainProcess?.shell?.openExternal) {
            return window.mainProcess.shell.openExternal(url);
        }
        console.warn('shell.openExternal not available');
        return { success: false, error: 'shell.openExternal not available' };
    },
    runCommand: async (command, options) => {
        if (window.mainProcess?.shell?.runCommand) {
            return window.mainProcess.shell.runCommand(command, options);
        }
        console.warn('shell.runCommand not available');
        return { success: false, error: 'shell.runCommand not available' };
    },
    openInEditor: async (params) => {
        if (window.mainProcess?.shell?.openInEditor) {
            return window.mainProcess.shell.openInEditor(params);
        }
        console.warn('shell.openInEditor not available');
        return { success: false, error: 'shell.openInEditor not available' };
    },
    openInTerminal: async (params) => {
        if (window.mainProcess?.shell?.openInTerminal) {
            return window.mainProcess.shell.openInTerminal(params);
        }
        console.warn('shell.openInTerminal not available');
        return { success: false, error: 'shell.openInTerminal not available' };
    },
};
