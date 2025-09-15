import { ipcRenderer } from 'electron';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import type { TerminalAPI, TerminalInfo, TerminalData, TerminalExit } from '../../shared/main-process-api-interfaces/TerminalService';

export const terminalAPI: TerminalAPI = {
  create: async (directory: string): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CREATE, directory);
  },
  
  getOrCreate: async (directory: string): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.GET_OR_CREATE, directory);
  },

  createWithCommand: async (directory: string, command: string): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CREATE_WITH_COMMAND, { directory, command });
  },

  write: async (sessionId: string, data: string): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.WRITE, sessionId, data);
  },

  resize: async (
    sessionId: string,
    cols: number,
    rows: number,
  ): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.RESIZE, sessionId, cols, rows);
  },

  destroy: async (sessionId: string): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.DESTROY, sessionId);
  },

  list: async (): Promise<
    Array<TerminalInfo>
  > => {
    return ipcRenderer.invoke(TerminalAPIEvents.LIST);
  },

  popOut: async (sessionId: string): Promise<{ windowId: number }> => {
    return ipcRenderer.invoke(TerminalAPIEvents.POP_OUT, sessionId);
  },
  
  focusWindow: async (windowId: number): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.FOCUS_WINDOW, windowId);
  },

  onData: (callback: (data: TerminalData) => void) => {
    const listener = (_event: any, data: TerminalData) =>
      callback(data);
    ipcRenderer.on(TerminalAPIEvents.ON_DATA, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_DATA, listener);
    };
  },

  onExit: (callback: (exit: TerminalExit) => void) => {
    const listener = (_event: any, exit: TerminalExit) =>
      callback(exit);
    ipcRenderer.on(TerminalAPIEvents.ON_EXIT, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_EXIT, listener);
    };
  },
  
  onWindowReady: (callback: (data: { terminalId: string; agentSessionId?: string; windowId: number }) => void) => {
    const listener = (_event: any, data: { terminalId: string; agentSessionId?: string; windowId: number }) =>
      callback(data);
    ipcRenderer.on(TerminalAPIEvents.ON_WINDOW_READY, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_WINDOW_READY, listener);
    };
  },

  refresh: async (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke(TerminalAPIEvents.REFRESH, sessionId);
  },
};
