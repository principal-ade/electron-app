/**
 * Shared types for Terminal TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 * This avoids cross-project import issues with TypeScript composite builds.
 */

// Input/output types for terminal router procedures

export interface CreateTerminalSessionInput {
  cwd?: string;
  command?: string;
  context?: string;
}

export interface DestroyTerminalSessionInput {
  sessionId: string;
}

export interface ResizeTerminalInput {
  sessionId: string;
  cols: number;
  rows: number;
  force?: boolean;
}

export interface RefreshTerminalInput {
  sessionId: string;
}

export interface OwnershipInput {
  sessionId: string;
  force?: boolean;
}

export interface RequestDataPortInput {
  sessionId: string;
}

// Output types
export interface TerminalSessionInfo {
  id: string;
  cwd?: string;
  directory?: string;
  context?: string;
  agentSessionId?: string;
  createdAt: number;
  lastActivity: number;
  status?: string;
  ownedByWindowId?: number;
}

export interface TerminalOwnershipStatus {
  isOwned: boolean;
  ownedByCurrentWindow: boolean;
  ownerWindowId: number | undefined;
}

export interface TerminalOwnershipResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
  previousOwner?: number;
}

export interface RefreshResult {
  success: boolean;
}

export interface RequestDataPortResult {
  success: boolean;
  sessionId: string;
  writable: boolean;
  error?: string;
}
