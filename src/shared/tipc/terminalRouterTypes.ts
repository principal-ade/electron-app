/**
 * Shared types for Terminal TIPC Router
 *
 * These types are shared between main process (implementation) and renderer (client).
 * This avoids cross-project import issues with TypeScript composite builds.
 */

import type { ActionContext } from '@egoist/tipc/main';

// Input/output types for terminal router procedures

/**
 * Metadata for terminal sessions running dev servers.
 * Used to persist port and context info across renderer restarts.
 */
export interface TerminalSessionMetadata {
  /** Port number for dev servers (Storybook, npm run dev, etc.) */
  port?: number;
  /** Package/workspace name being run */
  packageName?: string;
  /** Type of dev server or script */
  serverType?: 'storybook' | 'dev' | 'preview' | 'test';
  /** Repository name for display purposes */
  repoName?: string;
}

export interface CreateTerminalSessionInput {
  cwd?: string;
  command?: string;
  context?: string;
  metadata?: TerminalSessionMetadata;
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

export interface GetTerminalBufferInput {
  sessionId: string;
}

export interface GetTerminalBufferResult {
  success: boolean;
  buffer: string | null;
  size: number;
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
  metadata?: TerminalSessionMetadata;
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

// Activity tracking types
export interface UpdateActivityInput {
  sessionId: string;
  isWorking: boolean;
  workingMessage?: string;
  workingSubtitle?: string;
}

export interface TerminalActivityState {
  sessionId: string;
  isWorking: boolean;
  workingMessage?: string;
  workingSubtitle?: string;
  windowId: number;
  timestamp: number;
}

// Daemon status types
export interface DaemonMemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface DaemonStatusInfo {
  pid: number;
  uptime: number; // milliseconds since daemon started
  sessionCount: number;
  clientCount: number;
  memoryUsage: DaemonMemoryUsage;
  startedAt: string; // ISO timestamp
}

export interface DaemonStatusResponse {
  isRunning: boolean;
  status: DaemonStatusInfo | null;
}

export interface DaemonControlResult {
  success: boolean;
  error?: string;
}

/**
 * Terminal Router Type - TIPC RouterType-compatible type
 *
 * This defines the shape of the terminal router that both main and renderer can reference.
 * It satisfies the TIPC RouterType constraint for createClient<T>().
 * Uses Record<string, ...> to provide the required index signature.
 */
export type TerminalRouterType = Record<
  string,
  { action: (args: { context: ActionContext; input: unknown }) => Promise<unknown> }
> & {
  createTerminalSession: {
    action: (args: {
      context: ActionContext;
      input: CreateTerminalSessionInput;
    }) => Promise<string>;
  };
  destroyTerminalSession: {
    action: (args: {
      context: ActionContext;
      input: DestroyTerminalSessionInput;
    }) => Promise<void>;
  };
  listTerminalSessions: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<TerminalSessionInfo[]>;
  };
  resizeTerminal: {
    action: (args: {
      context: ActionContext;
      input: ResizeTerminalInput;
    }) => Promise<void>;
  };
  refreshTerminal: {
    action: (args: {
      context: ActionContext;
      input: RefreshTerminalInput;
    }) => Promise<RefreshResult>;
  };
  checkTerminalOwnership: {
    action: (args: {
      context: ActionContext;
      input: { sessionId: string };
    }) => Promise<{
      exists: boolean;
      ownedByWindowId: number | null;
      ownedByThisWindow: boolean;
      canClaim: boolean;
      ownerWindowExists: boolean;
    }>;
  };
  claimTerminalOwnership: {
    action: (args: {
      context: ActionContext;
      input: OwnershipInput;
    }) => Promise<TerminalOwnershipResult>;
  };
  releaseTerminalOwnership: {
    action: (args: {
      context: ActionContext;
      input: { sessionId: string };
    }) => Promise<TerminalOwnershipResult>;
  };
  requestTerminalDataPort: {
    action: (args: {
      context: ActionContext;
      input: RequestDataPortInput;
    }) => Promise<{ success: boolean; reason?: string }>;
  };
  getTerminalBuffer: {
    action: (args: {
      context: ActionContext;
      input: GetTerminalBufferInput;
    }) => Promise<GetTerminalBufferResult>;
  };
  updateActivity: {
    action: (args: {
      context: ActionContext;
      input: UpdateActivityInput;
    }) => Promise<void>;
  };
  getActivityState: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<TerminalActivityState[]>;
  };
  getDaemonStatus: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<DaemonStatusResponse>;
  };
  startDaemon: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<DaemonControlResult>;
  };
  stopDaemon: {
    action: (args: {
      context: ActionContext;
      input?: void;
    }) => Promise<DaemonControlResult>;
  };
}
