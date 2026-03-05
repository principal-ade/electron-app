import type { TerminalSessionMetadata } from '../../shared/tipc/terminalRouterTypes';

export type TerminalPortMessage =
  | { type: 'WRITE'; data: string }
  | { type: 'RESIZE'; cols: number; rows: number }
  | { type: 'DATA'; data: string };

// Owner types for local (Electron window) and remote (browser) clients
export type OwnerType = 'local' | 'remote';

export interface TerminalOwner {
  type: OwnerType;
  id: string; // windowId for 'local', clientId for 'remote'
  userId: string; // GitHub user ID
  githubHandle: string;
  claimedAt: number;
}

export interface RemoteClientInfo {
  clientId: string; // Control Tower client ID
  connectionId: string; // WebSocket connection ID
  githubHandle: string;
  userId: string;
  attachedAt: number;
}

export interface TerminalSession {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Importing node-pty types causes module load failures when pty unavailable
  pty: any;
  directory: string;
  context?: string; // 'principal' | 'dashboard' | 'agent' | etc
  createdAt: number;
  lastActivity: number;
  // Repository tracking for WebSocket room organization
  repoPath?: string;
  repoId?: string; // Format: "owner/repo"
  // Ownership and remote access
  owner: TerminalOwner | null;
  remoteAttachments: Set<string>; // Set of remote clientIds
  // Dev server metadata (port, package name, etc.)
  metadata?: TerminalSessionMetadata;
}

export interface OwnershipStatus {
  exists: boolean;
  owner: TerminalOwner | null;
  ownedByThisClient: boolean; // Generic - works for both local and remote
  canClaim: boolean;
  ownerExists: boolean; // Whether the owner connection/window still exists
  remoteClients: number; // Count of remote attachments
}

export interface OwnershipResult {
  success: boolean;
  reason?: string;
  owner?: TerminalOwner;
  previousOwner?: TerminalOwner;
}
