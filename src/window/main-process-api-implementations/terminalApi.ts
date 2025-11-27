import { ipcRenderer } from 'electron';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import type {
  TerminalAPI,
  TerminalInfo,
  TerminalExit,
  TerminalOwnershipStatus,
  TerminalOwnershipResult,
} from '../../shared/main-process-api-interfaces/TerminalService';

// Global port registry - stores MessagePorts for sessions
const sessionPorts = new Map<string, MessagePort>();

// Set up global PORT_READY listener immediately
ipcRenderer.on(
  TerminalAPIEvents.PORT_READY,
  (
    event: Electron.IpcRendererEvent,
    data: { sessionId: string; writable: boolean; ownershipToken?: string },
  ) => {
    const port = event.ports[0];
    if (port) {
      console.info(`[TerminalAPI] Received MessagePort for session ${data.sessionId}`);
      sessionPorts.set(data.sessionId, port);
      port.start(); // Start the port immediately
    } else {
      console.warn(`[TerminalAPI] PORT_READY event for ${data.sessionId} but no port found`);
    }
  },
);

export const terminalAPI: TerminalAPI = {
  create: async (directory: string, context?: string): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CREATE, directory, context);
  },

  getOrCreate: async (directory: string, context?: string): Promise<string> => {
    return ipcRenderer.invoke(
      TerminalAPIEvents.GET_OR_CREATE,
      directory,
      context,
    );
  },

  createWithCommand: async (
    directory: string,
    command: string,
    context?: string,
  ): Promise<string> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CREATE_WITH_COMMAND, {
      directory,
      command,
      context,
    });
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

  list: async (): Promise<Array<TerminalInfo>> => {
    return ipcRenderer.invoke(TerminalAPIEvents.LIST);
  },

  popOut: async (sessionId: string): Promise<{ windowId: number }> => {
    return ipcRenderer.invoke(TerminalAPIEvents.POP_OUT, sessionId);
  },

  focusWindow: async (windowId: number): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.FOCUS_WINDOW, windowId);
  },

  getOpenWindows: async (): Promise<
    Array<{ terminalId: string; windowId: number }>
  > => {
    return ipcRenderer.invoke(TerminalAPIEvents.GET_OPEN_WINDOWS);
  },

  // Session-specific data subscription - only receives data for this specific session
  // Requires MessagePort - no legacy IPC fallback
  onDataForSession: (sessionId: string, callback: (data: string) => void) => {
    // Check if we have a MessagePort for this session
    const existingPort = sessionPorts.get(sessionId);
    if (!existingPort) {
      console.error(
        `[TerminalAPI] No MessagePort available for session ${sessionId}. ` +
        `Data subscription will not receive any data. ` +
        `Available ports: ${Array.from(sessionPorts.keys()).join(', ') || 'none'}`,
      );
      // Return a no-op cleanup function
      return () => {};
    }

    console.info(`[TerminalAPI] Using MessagePort for session ${sessionId}`);

    // Listen for data on the MessagePort
    const portListener = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.type === 'DATA') {
        callback(message.data);
      }
    };
    existingPort.addEventListener('message', portListener);

    // Return cleanup function for port
    return () => {
      existingPort.removeEventListener('message', portListener);
    };
  },

  onExit: (callback: (exit: TerminalExit) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, exit: TerminalExit) =>
      callback(exit);
    ipcRenderer.on(TerminalAPIEvents.ON_EXIT, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_EXIT, listener);
    };
  },

  onWindowReady: (
    callback: (data: {
      terminalId: string;
      agentSessionId?: string;
      windowId: number;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { terminalId: string; agentSessionId?: string; windowId: number },
    ) => callback(data);
    ipcRenderer.on(TerminalAPIEvents.ON_WINDOW_READY, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_WINDOW_READY, listener);
    };
  },

  onWindowClose: (
    callback: (data: {
      terminalId: string;
      agentSessionId?: string;
      windowId: number;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { terminalId: string; agentSessionId?: string; windowId: number },
    ) => callback(data);
    ipcRenderer.on(TerminalAPIEvents.ON_WINDOW_CLOSE, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.ON_WINDOW_CLOSE, listener);
    };
  },

  refresh: async (sessionId: string): Promise<boolean> => {
    return ipcRenderer.invoke(TerminalAPIEvents.REFRESH, sessionId);
  },

  checkOwnership: async (
    sessionId: string,
  ): Promise<TerminalOwnershipStatus> => {
    return ipcRenderer.invoke(TerminalAPIEvents.CHECK_OWNERSHIP, sessionId);
  },

  claimOwnership: async (
    sessionId: string,
    force?: boolean,
  ): Promise<TerminalOwnershipResult> => {
    return ipcRenderer.invoke(
      TerminalAPIEvents.CLAIM_OWNERSHIP,
      sessionId,
      force,
    );
  },

  releaseOwnership: async (
    sessionId: string,
  ): Promise<TerminalOwnershipResult> => {
    return ipcRenderer.invoke(TerminalAPIEvents.RELEASE_OWNERSHIP, sessionId);
  },

  onOwnershipLost: (
    callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { sessionId: string; newOwnerWindowId: number },
    ) => callback(data);
    ipcRenderer.on(TerminalAPIEvents.OWNERSHIP_LOST, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.OWNERSHIP_LOST, listener);
    };
  },

  onPortReady: (
    callback: (
      data: { sessionId: string; writable: boolean; ownershipToken?: string },
      port: MessagePort,
    ) => void,
  ) => {
    const listener = (
      event: Electron.IpcRendererEvent,
      data: { sessionId: string; writable: boolean; ownershipToken?: string },
    ) => {
      // The first port in the event.ports array is our MessagePort
      const port = event.ports[0];
      if (port) {
        console.info('[TerminalAPI] Received MessagePort for session:', data.sessionId);
        callback(data, port);
      } else {
        console.warn('[TerminalAPI] PORT_READY event received but no port found');
      }
    };
    ipcRenderer.on(TerminalAPIEvents.PORT_READY, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.PORT_READY, listener);
    };
  },

  requestDataPort: async (sessionId: string): Promise<{ success: boolean; reason?: string }> => {
    return ipcRenderer.invoke(TerminalAPIEvents.REQUEST_DATA_PORT, sessionId);
  },
};
