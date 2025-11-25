export enum TerminalAPIEvents {
  CREATE = 'terminal:create',
  GET_OR_CREATE = 'terminal:getOrCreate',
  CREATE_WITH_COMMAND = 'terminal:create-with-command',
  WRITE = 'terminal:write',
  RESIZE = 'terminal:resize',
  DESTROY = 'terminal:destroy',
  LIST = 'terminal:list',
  POP_OUT = 'terminal:popOut',
  FOCUS_WINDOW = 'terminal:focusWindow',
  REFRESH = 'terminal:refresh',
  ON_DATA = 'terminal:data',
  ON_EXIT = 'terminal:exit',
  ON_WINDOW_READY = 'terminal:window-ready',
  ON_WINDOW_CLOSE = 'terminal:window-close',
  CHECK_COMMAND = 'terminal:checkCommand',
  CLEAR_PATH_CACHE = 'terminal:clearPathCache',
  GET_OPEN_WINDOWS = 'terminal:getOpenWindows',
  CHECK_OWNERSHIP = 'terminal:checkOwnership',
  CLAIM_OWNERSHIP = 'terminal:claimOwnership',
  RELEASE_OWNERSHIP = 'terminal:releaseOwnership',
  OWNERSHIP_LOST = 'terminal:ownershipLost',
  PORT_READY = 'terminal:portReady', // NEW: MessagePort ready for direct streaming
}

export interface TerminalInfo {
  id: string;
  directory: string;
  context?: string; // 'principal' | 'dashboard' | 'agent' | etc
  agentSessionId?: string;
  createdAt: number;
  lastActivity: number;
  status: 'active' | 'disconnected';
  ownedByWindowId?: number; // NEW: Which window has active ownership
  ownershipClaimedAt?: number; // NEW: When ownership was claimed
}

export interface TerminalOwnershipStatus {
  exists: boolean;
  ownedByWindowId: number | null;
  ownedByThisWindow?: boolean;
  canClaim: boolean;
  ownerWindowExists?: boolean;
}

export interface TerminalOwnershipResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
}
export interface TerminalData {
  sessionId: string;
  data: string;
}

export interface TerminalExit {
  sessionId: string;
  code: number;
}

export interface TerminalAPI {
  create: (directory: string, context?: string) => Promise<string>;
  getOrCreate: (directory: string, context?: string) => Promise<string>;
  createWithCommand: (
    directory: string,
    command: string,
    context?: string,
  ) => Promise<string>;
  write: (sessionId: string, data: string) => Promise<void>;
  resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  destroy: (sessionId: string) => Promise<void>;
  list: () => Promise<Array<TerminalInfo>>;
  popOut: (sessionId: string) => Promise<{ windowId: number }>;
  focusWindow: (windowId: number) => Promise<void>;
  getOpenWindows: () => Promise<
    Array<{ terminalId: string; windowId: number }>
  >;
  onDataForSession: (sessionId: string, callback: (data: string) => void) => () => void;
  onExit: (callback: (exit: TerminalExit) => void) => () => void;
  onWindowReady: (
    callback: (data: {
      terminalId: string;
      agentSessionId?: string;
      windowId: number;
    }) => void,
  ) => () => void;
  onWindowClose: (
    callback: (data: {
      terminalId: string;
      agentSessionId?: string;
      windowId: number;
    }) => void,
  ) => () => void;
  refresh: (sessionId: string) => Promise<boolean>;
  checkOwnership: (sessionId: string) => Promise<TerminalOwnershipStatus>;
  claimOwnership: (
    sessionId: string,
    force?: boolean,
  ) => Promise<TerminalOwnershipResult>;
  releaseOwnership: (sessionId: string) => Promise<TerminalOwnershipResult>;
  onOwnershipLost: (
    callback: (data: { sessionId: string; newOwnerWindowId: number }) => void,
  ) => () => void;
}
