/**
 * Terminal Event Types for WebSocket Protocol
 *
 * These events are used for terminal streaming between Electron app and browser clients
 * via the Control Tower WebSocket server.
 */

// Terminal-specific event types
export type TerminalEventType =
  | 'terminal:session_list' // List all sessions for user
  | 'terminal:session_created' // New session created
  | 'terminal:session_destroyed' // Session destroyed
  | 'terminal:attach' // Request to attach to session
  | 'terminal:detach' // Detach from session
  | 'terminal:claim_ownership' // Claim write ownership
  | 'terminal:release_ownership' // Release write ownership
  | 'terminal:ownership_changed' // Ownership changed notification
  | 'terminal:data' // PTY data streaming
  | 'terminal:write' // Write to PTY (owner only)
  | 'terminal:resize' // Resize PTY (owner only)
  | 'terminal:error'; // Error notification

// Session information for wire protocol
export interface TerminalSessionInfo {
  sessionId: string;
  repoPath: string;
  repoId: string; // Format: "owner/repo"
  directory: string;
  context?: string;
  createdAt: number;
  lastActivity: number;
  owner: {
    type: 'local' | 'remote';
    id: string;
    githubHandle: string;
  } | null;
  attached: boolean; // Is current client attached?
  isOwner: boolean; // Does current client own it?
}

// Event payloads

export interface TerminalSessionListPayload {
  sessions: TerminalSessionInfo[];
}

export interface TerminalSessionCreatedPayload {
  session: TerminalSessionInfo;
}

export interface TerminalSessionDestroyedPayload {
  sessionId: string;
}

export interface TerminalAttachPayload {
  sessionId: string;
  asOwner: boolean; // Request ownership on attach
}

export interface TerminalDetachPayload {
  sessionId: string;
}

export interface TerminalClaimOwnershipPayload {
  sessionId: string;
  force?: boolean;
}

export interface TerminalReleaseOwnershipPayload {
  sessionId: string;
}

export interface TerminalOwnershipChangedPayload {
  sessionId: string;
  newOwner: {
    type: 'local' | 'remote';
    id: string;
    githubHandle: string;
  } | null;
  previousOwner: {
    type: 'local' | 'remote';
    id: string;
    githubHandle: string;
  } | null;
}

export interface TerminalDataPayload {
  sessionId: string;
  data: string; // Base64 encoded PTY output
  sequence: number; // For ordering
}

export interface TerminalWritePayload {
  sessionId: string;
  data: string; // Input to send to PTY
}

export interface TerminalResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalErrorPayload {
  sessionId: string;
  error: string;
  code?: string;
}

// Generic terminal event structure
export interface TerminalEvent {
  id: string;
  type: TerminalEventType;
  timestamp: number;
  userId: string;
  roomId: string; // Format: "terminals:owner/repo"
  data:
    | TerminalSessionListPayload
    | TerminalSessionCreatedPayload
    | TerminalSessionDestroyedPayload
    | TerminalAttachPayload
    | TerminalDetachPayload
    | TerminalClaimOwnershipPayload
    | TerminalReleaseOwnershipPayload
    | TerminalOwnershipChangedPayload
    | TerminalDataPayload
    | TerminalWritePayload
    | TerminalResizePayload
    | TerminalErrorPayload;
  metadata?: {
    sessionId?: string;
    repoId?: string;
  };
}

// Helper type guards
export function isTerminalEvent(type: string): type is TerminalEventType {
  return type.startsWith('terminal:');
}

export function isTerminalDataEvent(
  event: TerminalEvent,
): event is TerminalEvent & { data: TerminalDataPayload } {
  return event.type === 'terminal:data';
}

export function isTerminalWriteEvent(
  event: TerminalEvent,
): event is TerminalEvent & { data: TerminalWritePayload } {
  return event.type === 'terminal:write';
}

export function isTerminalOwnershipEvent(
  event: TerminalEvent,
): event is TerminalEvent & { data: TerminalOwnershipChangedPayload } {
  return event.type === 'terminal:ownership_changed';
}

// Helper to convert owner object to wire format
export function ownerToWireFormat(owner: {
  type: 'local' | 'remote';
  id: string;
  githubHandle: string;
} | null): TerminalSessionInfo['owner'] {
  if (!owner) return null;
  return {
    type: owner.type,
    id: owner.id,
    githubHandle: owner.githubHandle,
  };
}
