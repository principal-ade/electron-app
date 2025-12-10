export enum TerminalAPIEvents {
  CREATE = 'terminal:create',
  GET_OR_CREATE = 'terminal:getOrCreate',
  CREATE_WITH_COMMAND = 'terminal:create-with-command',
  WRITE = 'terminal:write',
  RESIZE = 'terminal:resize',
  DESTROY = 'terminal:destroy',
  LIST = 'terminal:list',
  REFRESH = 'terminal:refresh',
  ON_DATA = 'terminal:data',
  ON_EXIT = 'terminal:exit',
  CHECK_COMMAND = 'terminal:checkCommand',
  CLEAR_PATH_CACHE = 'terminal:clearPathCache',
  CHECK_OWNERSHIP = 'terminal:checkOwnership',
  CLAIM_OWNERSHIP = 'terminal:claimOwnership',
  RELEASE_OWNERSHIP = 'terminal:releaseOwnership',
  OWNERSHIP_LOST = 'terminal:ownershipLost',
  PORT_READY = 'terminal:portReady', // MessagePort ready for direct streaming
  REQUEST_DATA_PORT = 'terminal:requestDataPort', // Request a MessagePort for terminal data
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
  previousOwner?: number;
}
export interface TerminalData {
  sessionId: string;
  data: string;
}

export interface TerminalExit {
  sessionId: string;
  code: number;
}

export interface PortReadyData {
  sessionId: string;
  writable: boolean;
  ownershipToken?: string;
}

export interface RequestDataPortResult {
  success: boolean;
  reason?: string;
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
  resize: (sessionId: string, cols: number, rows: number, force?: boolean) => Promise<void>;
  destroy: (sessionId: string) => Promise<void>;
  list: () => Promise<Array<TerminalInfo>>;
  onDataForSession: (sessionId: string, callback: (data: string) => void) => () => void;
  onExit: (callback: (exit: TerminalExit) => void) => () => void;
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
  onPortReady: (
    callback: (data: PortReadyData, port: MessagePort) => void,
  ) => () => void;
  /**
   * Request a MessagePort for receiving terminal data directly.
   * The port will be delivered via the PORT_READY event.
   * This bypasses IPC for high-performance data streaming.
   */
  requestDataPort: (sessionId: string) => Promise<RequestDataPortResult>;
}
