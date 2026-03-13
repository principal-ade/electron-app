/**
 * PTY Daemon Protocol Types
 *
 * JSON-based protocol for communication between Electron main process
 * and the external PTY daemon over Unix domain socket.
 */

// ============================================================================
// Client → Daemon Messages
// ============================================================================

export interface CreateSessionMessage {
  type: 'create';
  id: string;
  cwd: string;
  shell?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface WriteMessage {
  type: 'write';
  id: string;
  data: string;
}

export interface ResizeMessage {
  type: 'resize';
  id: string;
  cols: number;
  rows: number;
}

export interface DestroyMessage {
  type: 'destroy';
  id: string;
}

export interface ListMessage {
  type: 'list';
}

export interface AttachMessage {
  type: 'attach';
  id: string;
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage =
  | CreateSessionMessage
  | WriteMessage
  | ResizeMessage
  | DestroyMessage
  | ListMessage
  | AttachMessage
  | PingMessage;

// ============================================================================
// Daemon → Client Messages
// ============================================================================

export interface CreatedMessage {
  type: 'created';
  id: string;
  pid: number;
}

export interface DataMessage {
  type: 'data';
  id: string;
  data: string;
}

export interface ExitMessage {
  type: 'exit';
  id: string;
  exitCode: number;
  signal?: string;
}

export interface ErrorMessage {
  type: 'error';
  id?: string;
  error: string;
}

export interface SessionsMessage {
  type: 'sessions';
  sessions: SessionInfo[];
}

export interface ScrollbackMessage {
  type: 'scrollback';
  id: string;
  data: string;
}

export interface PongMessage {
  type: 'pong';
}

export type DaemonMessage =
  | CreatedMessage
  | DataMessage
  | ExitMessage
  | ErrorMessage
  | SessionsMessage
  | ScrollbackMessage
  | PongMessage;

// ============================================================================
// Shared Types
// ============================================================================

export interface SessionInfo {
  id: string;
  cwd: string;
  pid: number;
  createdAt: string; // ISO timestamp
  lastActivity: string; // ISO timestamp
  cols: number;
  rows: number;
}

// ============================================================================
// Protocol Helpers
// ============================================================================

/**
 * Serialize a message for transmission over socket.
 * Messages are newline-delimited JSON.
 */
export function serializeMessage(msg: ClientMessage | DaemonMessage): string {
  return JSON.stringify(msg) + '\n';
}

/**
 * Parse a message from socket data.
 * Returns null if parsing fails.
 */
export function parseMessage<T extends ClientMessage | DaemonMessage>(
  data: string
): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Type guard for ClientMessage
 */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: string };
  return ['create', 'write', 'resize', 'destroy', 'list', 'attach', 'ping'].includes(
    m.type ?? ''
  );
}

/**
 * Type guard for DaemonMessage
 */
export function isDaemonMessage(msg: unknown): msg is DaemonMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: string };
  return ['created', 'data', 'exit', 'error', 'sessions', 'scrollback', 'pong'].includes(
    m.type ?? ''
  );
}
