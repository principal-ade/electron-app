import { ipcRenderer } from 'electron';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
export const terminalAPI = {
    create: async (directory) => {
        return ipcRenderer.invoke(TerminalAPIEvents.CREATE, directory);
    },
    getOrCreate: async (directory) => {
        return ipcRenderer.invoke(TerminalAPIEvents.GET_OR_CREATE, directory);
    },
    createWithCommand: async (directory, command) => {
        return ipcRenderer.invoke(TerminalAPIEvents.CREATE_WITH_COMMAND, { directory, command });
    },
    write: async (sessionId, data) => {
        return ipcRenderer.invoke(TerminalAPIEvents.WRITE, sessionId, data);
    },
    resize: async (sessionId, cols, rows) => {
        return ipcRenderer.invoke(TerminalAPIEvents.RESIZE, sessionId, cols, rows);
    },
    destroy: async (sessionId) => {
        return ipcRenderer.invoke(TerminalAPIEvents.DESTROY, sessionId);
    },
    list: async () => {
        return ipcRenderer.invoke(TerminalAPIEvents.LIST);
    },
    popOut: async (sessionId) => {
        return ipcRenderer.invoke(TerminalAPIEvents.POP_OUT, sessionId);
    },
    focusWindow: async (windowId) => {
        return ipcRenderer.invoke(TerminalAPIEvents.FOCUS_WINDOW, windowId);
    },
    onData: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(TerminalAPIEvents.ON_DATA, listener);
        return () => {
            ipcRenderer.removeListener(TerminalAPIEvents.ON_DATA, listener);
        };
    },
    onExit: (callback) => {
        const listener = (_event, exit) => callback(exit);
        ipcRenderer.on(TerminalAPIEvents.ON_EXIT, listener);
        return () => {
            ipcRenderer.removeListener(TerminalAPIEvents.ON_EXIT, listener);
        };
    },
    onWindowReady: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(TerminalAPIEvents.ON_WINDOW_READY, listener);
        return () => {
            ipcRenderer.removeListener(TerminalAPIEvents.ON_WINDOW_READY, listener);
        };
    },
    refresh: async (sessionId) => {
        return ipcRenderer.invoke(TerminalAPIEvents.REFRESH, sessionId);
    },
};
