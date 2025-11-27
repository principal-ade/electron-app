export type TerminalPortMessage =
  | { type: 'WRITE'; data: string }
  | { type: 'RESIZE'; cols: number; rows: number }
  | { type: 'DATA'; data: string };

export interface TerminalSession {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Importing node-pty types causes module load failures when pty unavailable
  pty: any;
  directory: string;
  context?: string; // 'principal' | 'dashboard' | 'agent' | etc
  agentSessionId?: string; // Associated AI session
  createdAt: number;
  lastActivity: number;
  ownedByWindowId?: number; // Which window currently has the active xterm.js instance
  ownershipClaimedAt?: number; // When ownership was last claimed
  activeViewers: Set<number>; // Set of window IDs actively viewing this terminal
}

export interface TerminalWindowInfo {
  terminalId: string;
  windowId: number;
}

export interface OwnershipCheckResult {
  exists: boolean;
  ownedByWindowId: number | null;
  ownedByThisWindow?: boolean;
  canClaim?: boolean;
  ownerWindowExists?: boolean;
}

export interface OwnershipClaimResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
}
