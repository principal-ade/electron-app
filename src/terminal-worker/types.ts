/**
 * Message types for terminal worker <-> main process communication
 */

// =============================================================================
// Base Message Types
// =============================================================================

export interface BaseMessage {
  id: string;
  timestamp: number;
}

// =============================================================================
// Main -> Worker Messages
// =============================================================================

export interface CreateSessionMessage extends BaseMessage {
  type: 'CREATE_SESSION';
  sessionId: string;
  directory: string;
  context?: string;
  command?: string;
  shell: string;
  env: Record<string, string>;
}

export interface DestroySessionMessage extends BaseMessage {
  type: 'DESTROY_SESSION';
  sessionId: string;
}

export interface WriteToSessionMessage extends BaseMessage {
  type: 'WRITE';
  sessionId: string;
  data: string;
}

export interface ResizeSessionMessage extends BaseMessage {
  type: 'RESIZE';
  sessionId: string;
  cols: number;
  rows: number;
  force?: boolean;
}

export interface RefreshSessionMessage extends BaseMessage {
  type: 'REFRESH';
  sessionId: string;
}

export interface RegisterPortMessage extends BaseMessage {
  type: 'REGISTER_PORT';
  sessionId: string;
  windowId: number;
  isOwner: boolean;
}

export interface UnregisterPortMessage extends BaseMessage {
  type: 'UNREGISTER_PORT';
  sessionId: string;
  windowId: number;
}

export interface SetOwnerMessage extends BaseMessage {
  type: 'SET_OWNER';
  sessionId: string;
  windowId: number;
}

export interface ShutdownMessage extends BaseMessage {
  type: 'SHUTDOWN';
}

export interface ConnectDaemonMessage extends BaseMessage {
  type: 'CONNECT_DAEMON';
  socketPath: string;
}

export interface DisconnectDaemonMessage extends BaseMessage {
  type: 'DISCONNECT_DAEMON';
}

export interface GetScrollbackMessage extends BaseMessage {
  type: 'GET_SCROLLBACK';
  sessionId: string;
  requestId: string;
}

export type MainToWorkerMessage =
  | CreateSessionMessage
  | DestroySessionMessage
  | WriteToSessionMessage
  | ResizeSessionMessage
  | RefreshSessionMessage
  | RegisterPortMessage
  | UnregisterPortMessage
  | SetOwnerMessage
  | ShutdownMessage
  | ConnectDaemonMessage
  | DisconnectDaemonMessage
  | GetScrollbackMessage;

// =============================================================================
// Worker -> Main Messages
// =============================================================================

export interface ReadyMessage extends BaseMessage {
  type: 'READY';
}

export interface SessionCreatedMessage extends BaseMessage {
  type: 'SESSION_CREATED';
  sessionId: string;
  success: boolean;
  error?: string;
}

export interface SessionExitMessage extends BaseMessage {
  type: 'SESSION_EXIT';
  sessionId: string;
  exitCode: number;
}

export interface SessionErrorMessage extends BaseMessage {
  type: 'SESSION_ERROR';
  sessionId: string;
  error: string;
}

export interface WorkerErrorMessage extends BaseMessage {
  type: 'WORKER_ERROR';
  error: string;
  context?: Record<string, unknown>;
}

export interface DaemonConnectedMessage extends BaseMessage {
  type: 'DAEMON_CONNECTED';
}

export interface DaemonDisconnectedMessage extends BaseMessage {
  type: 'DAEMON_DISCONNECTED';
  error?: string;
}

export interface DaemonSessionsMessage extends BaseMessage {
  type: 'DAEMON_SESSIONS';
  sessions: DaemonSessionInfo[];
}

export interface ScrollbackResponseMessage extends BaseMessage {
  type: 'SCROLLBACK_RESPONSE';
  sessionId: string;
  requestId: string;
  buffer: string | null;
}

/**
 * Session info from daemon (matches protocol.ts SessionInfo)
 */
export interface DaemonSessionInfo {
  id: string;
  cwd: string;
  pid: number;
  createdAt: string;
  lastActivity: string;
  cols: number;
  rows: number;
}

export type WorkerToMainMessage =
  | ReadyMessage
  | SessionCreatedMessage
  | SessionExitMessage
  | SessionErrorMessage
  | WorkerErrorMessage
  | DaemonConnectedMessage
  | DaemonDisconnectedMessage
  | DaemonSessionsMessage
  | ScrollbackResponseMessage;

// =============================================================================
// Port Messages (sent via MessagePort between worker and renderer)
// =============================================================================

export interface TerminalDataMessage {
  type: 'DATA';
  data: string;
}

export interface TerminalWriteMessage {
  type: 'WRITE';
  data: string;
}

export interface TerminalResizeMessage {
  type: 'RESIZE';
  cols: number;
  rows: number;
}

export type RendererToWorkerPortMessage =
  | TerminalWriteMessage
  | TerminalResizeMessage;

export type WorkerToRendererPortMessage = TerminalDataMessage;
