/**
 * TIPC Client for Terminal Operations
 *
 * This provides type-safe RPC for terminal management, matching the
 * terminal-testing-app implementation.
 */

import { createClient } from '@egoist/tipc/renderer';
import type {
  CreateTerminalSessionInput,
  DestroyTerminalSessionInput,
  WriteToTerminalInput,
  ResizeTerminalInput,
  RefreshTerminalInput,
  OwnershipInput,
  RequestDataPortInput,
  TerminalSessionInfo,
  TerminalOwnershipResult,
  RefreshResult,
} from '../../shared/tipc/terminalRouterTypes';

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke: typeof Electron.ipcRenderer.invoke;
        on: (
          channel: string,
          handler: (...args: unknown[]) => void,
        ) => () => void;
        send: typeof Electron.ipcRenderer.send;
      };
      onTerminalData: (
        sessionId: string,
        callback: (data: string) => void,
      ) => () => void;
      onOwnershipLost: (
        callback: (data: {
          sessionId: string;
          newOwnerWindowId: number;
        }) => void,
      ) => () => void;
      // Fast terminal write using MessagePort (no IPC round-trip)
      writeToTerminalPort: (sessionId: string, data: string) => boolean;
      // Check if MessagePort is available for a session
      hasTerminalPort: (sessionId: string) => boolean;
    };
  }
}

// Define the client interface to match main process router implementation
// This avoids importing from main process which breaks TypeScript project boundaries
export interface TerminalClient {
  createTerminalSession: (input: CreateTerminalSessionInput) => Promise<string>;
  destroyTerminalSession: (input: DestroyTerminalSessionInput) => Promise<void>;
  listTerminalSessions: () => Promise<TerminalSessionInfo[]>;
  writeToTerminal: (input: WriteToTerminalInput) => Promise<void>;
  resizeTerminal: (input: ResizeTerminalInput) => Promise<void>;
  refreshTerminal: (input: RefreshTerminalInput) => Promise<RefreshResult>;
  checkTerminalOwnership: (input: { sessionId: string }) => Promise<{
    exists: boolean;
    ownedByWindowId: number | null;
    ownedByThisWindow: boolean;
    canClaim: boolean;
    ownerWindowExists: boolean;
  }>;
  claimTerminalOwnership: (
    input: OwnershipInput,
  ) => Promise<TerminalOwnershipResult>;
  releaseTerminalOwnership: (input: {
    sessionId: string;
  }) => Promise<TerminalOwnershipResult>;
  requestTerminalDataPort: (input: RequestDataPortInput) => Promise<{
    success: boolean;
    reason?: string;
  }>;
}

// Lazy-initialized TIPC client for terminal operations
// We use lazy initialization because window.electron is injected by the preload script
// and isn't available at module load time.
let _terminalClient: TerminalClient | null = null;

function getTerminalClient(): TerminalClient {
  if (!_terminalClient) {
    if (!window.electron?.ipcRenderer?.invoke) {
      throw new Error(
        'Terminal client not available - window.electron not initialized',
      );
    }
    _terminalClient = createClient<any>({
      ipcInvoke: window.electron.ipcRenderer.invoke,
    }) as unknown as TerminalClient;
  }
  return _terminalClient;
}

// Export a proxy object that lazily accesses the client
export const terminalClient: TerminalClient = new Proxy({} as TerminalClient, {
  get(_target, prop: keyof TerminalClient) {
    const client = getTerminalClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Re-export terminal data APIs from preload (also lazy)
export const onTerminalData = (
  sessionId: string,
  callback: (data: string) => void,
) => {
  return window.electron.onTerminalData(sessionId, callback);
};

export const onOwnershipLost = (
  callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
) => {
  return window.electron.onOwnershipLost(callback);
};

/**
 * Fast terminal write using MessagePort (no IPC round-trip).
 * Returns true if write was sent via port, false if port not available.
 */
export const writeToTerminalPort = (
  sessionId: string,
  data: string,
): boolean => {
  return window.electron.writeToTerminalPort(sessionId, data);
};

/**
 * Check if MessagePort is available for a session.
 */
export const hasTerminalPort = (sessionId: string): boolean => {
  return window.electron.hasTerminalPort(sessionId);
};
