export interface TerminalSession {
  id: string;
  pty: any; // Changed from pty.IPty to any for optional support
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
