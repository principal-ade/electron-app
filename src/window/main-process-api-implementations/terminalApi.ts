import { ipcRenderer } from 'electron';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import type {
  TerminalAPI,
  TerminalInfo,
  TerminalExit,
  TerminalOwnershipStatus,
  TerminalOwnershipResult,
} from '../../shared/main-process-api-interfaces/TerminalService';

// ============================================
// Terminal MessagePort Management
// ============================================

// Store active MessagePorts by session ID
const sessionPorts = new Map<string, MessagePort>();

// Store data subscribers by session ID (allows subscribing before port arrives)
const terminalSubscribers = new Map<string, Set<(data: string) => void>>();

// Store ownership lost subscribers
const ownershipLostSubscribers = new Set<
  (data: { sessionId: string; newOwnerWindowId: number }) => void
>();

// Set up global PORT_READY listener immediately
ipcRenderer.on(
  TerminalAPIEvents.PORT_READY,
  (
    event: Electron.IpcRendererEvent,
    data: { sessionId: string; writable: boolean; ownershipToken?: string },
  ) => {
    const port = event.ports[0];
    if (!port) {
      console.warn(
        `[TerminalAPI] PORT_READY event for ${data.sessionId} but no port found`,
      );
      return;
    }

    console.info(
      `[TerminalAPI] Received MessagePort for session ${data.sessionId}`,
    );

    // Store the port
    sessionPorts.set(data.sessionId, port);

    // Start the port
    port.start();

    // Route incoming data to subscribers
    port.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'DATA') {
        const subscribers = terminalSubscribers.get(data.sessionId);
        if (subscribers && subscribers.size > 0) {
          subscribers.forEach((cb) => cb(e.data.data));
        }
      } else if (e.data?.type === 'EXIT') {
        console.log(`[TerminalAPI] Terminal session ${data.sessionId} exited`);
        // Clean up on exit
        sessionPorts.delete(data.sessionId);
        terminalSubscribers.delete(data.sessionId);
      }
    };

    // Log if there are already subscribers waiting
    const existingSubscribers = terminalSubscribers.get(data.sessionId);
    if (existingSubscribers && existingSubscribers.size > 0) {
      console.info(
        `[TerminalAPI] Port ready, ${existingSubscribers.size} subscriber(s) waiting for session ${data.sessionId}`,
      );
    }
  },
);

// Set up ownership lost listener
ipcRenderer.on(
  TerminalAPIEvents.OWNERSHIP_LOST,
  (
    _event: Electron.IpcRendererEvent,
    data: { sessionId: string; newOwnerWindowId: number },
  ) => {
    console.log(
      `[TerminalAPI] Ownership lost for session ${data.sessionId}, new owner: ${data.newOwnerWindowId}`,
    );
    ownershipLostSubscribers.forEach((cb) => cb(data));
  },
);

// ============================================
// Terminal API Implementation
// ============================================

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
    force?: boolean,
  ): Promise<void> => {
    return ipcRenderer.invoke(
      TerminalAPIEvents.RESIZE,
      sessionId,
      cols,
      rows,
      force,
    );
  },

  destroy: async (sessionId: string): Promise<void> => {
    return ipcRenderer.invoke(TerminalAPIEvents.DESTROY, sessionId);
  },

  list: async (): Promise<Array<TerminalInfo>> => {
    return ipcRenderer.invoke(TerminalAPIEvents.LIST);
  },

  // Session-specific data subscription
  // Uses subscriber pattern - can subscribe before port arrives
  onDataForSession: (sessionId: string, callback: (data: string) => void) => {
    // Initialize subscriber set for this session if needed
    if (!terminalSubscribers.has(sessionId)) {
      terminalSubscribers.set(sessionId, new Set());
    }

    // Add the callback to subscribers
    terminalSubscribers.get(sessionId)!.add(callback);

    const hasPort = sessionPorts.has(sessionId);
    console.info(
      `[TerminalAPI] Subscribed to terminal data for session ${sessionId} (port ${hasPort ? 'ready' : 'pending'})`,
    );

    // Return unsubscribe function
    return () => {
      const subscribers = terminalSubscribers.get(sessionId);
      if (subscribers) {
        subscribers.delete(callback);
        console.info(
          `[TerminalAPI] Unsubscribed from terminal data for session ${sessionId}`,
        );

        // Clean up empty subscriber sets
        if (subscribers.size === 0) {
          terminalSubscribers.delete(sessionId);
        }
      }
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
    ownershipLostSubscribers.add(callback);
    console.info('[TerminalAPI] Subscribed to ownership lost events');

    return () => {
      ownershipLostSubscribers.delete(callback);
      console.info('[TerminalAPI] Unsubscribed from ownership lost events');
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
      const port = event.ports[0];
      if (port) {
        callback(data, port);
      }
    };
    ipcRenderer.on(TerminalAPIEvents.PORT_READY, listener);
    return () => {
      ipcRenderer.removeListener(TerminalAPIEvents.PORT_READY, listener);
    };
  },

  requestDataPort: async (
    sessionId: string,
  ): Promise<{ success: boolean; reason?: string }> => {
    return ipcRenderer.invoke(TerminalAPIEvents.REQUEST_DATA_PORT, sessionId);
  },
};
