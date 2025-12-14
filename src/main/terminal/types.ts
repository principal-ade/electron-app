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
  createdAt: number;
  lastActivity: number;
}

export interface OwnershipStatus {
  exists: boolean;
  ownedByWindowId: number | null;
  ownedByThisWindow: boolean;
  canClaim: boolean;
  ownerWindowExists: boolean;
}

export interface OwnershipResult {
  success: boolean;
  reason?: string;
  ownedByWindowId?: number;
  previousOwner?: number;
}
