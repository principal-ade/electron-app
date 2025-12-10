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
        on: (channel: string, handler: (...args: unknown[]) => void) => () => void;
        send: typeof Electron.ipcRenderer.send;
      };
      onTerminalData: (sessionId: string, callback: (data: string) => void) => () => void;
      onOwnershipLost: (callback: (data: { sessionId: string; newOwnerWindowId: number }) => void) => () => void;
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
  claimTerminalOwnership: (input: OwnershipInput) => Promise<TerminalOwnershipResult>;
  releaseTerminalOwnership: (input: { sessionId: string }) => Promise<TerminalOwnershipResult>;
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
      throw new Error('Terminal client not available - window.electron not initialized');
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
export const onTerminalData = (sessionId: string, callback: (data: string) => void) => {
  return window.electron.onTerminalData(sessionId, callback);
};

export const onOwnershipLost = (callback: (data: { sessionId: string; newOwnerWindowId: number }) => void) => {
  return window.electron.onOwnershipLost(callback);
};
