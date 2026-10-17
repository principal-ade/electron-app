/**
 * Process Registry API
 *
 * Shared model for the app's managed-process surface. A "process" is either:
 * - `managed` — a long-lived command the app started (via the UI or, for an
 *   agent, the Principal MCP bridge); or
 * - `detected` — a local server found listening on a dev port that we did NOT
 *   start (reported by localhost detection).
 *
 * Identity is a durable, main-generated `id` — never the OS pid, which is
 * diagnostic only, may be absent, and changes across restarts.
 */

export type ProcessStatus =
  | 'starting'
  | 'running'
  | 'restarting'
  | 'stopping'
  | 'stopped'
  | 'failed';

/** Coarse classification of what kind of process this is. */
export type ProcessKind =
  | 'dev-server'
  | 'watcher'
  | 'task'
  | 'agent'
  | 'script';

/** A process's cwd resolved to a known git repository (best-effort). */
export interface ProcessRepo {
  /** Repository display name (e.g. "electron-app"). */
  name: string;
  /** Owner login (user or org), when known. */
  owner?: string;
  /** Owner avatar URL, when resolved. */
  avatarUrl?: string;
  /** Canonical repo PURL, when known. */
  purl?: string;
}

/** Where a process came from. */
export type ProcessOrigin = 'managed' | 'detected';

export interface ProcessEntry {
  /** Stable, durable id minted by the registry. Never the pid. */
  id: string;
  /** Human-readable label shown as the row title. */
  label: string;
  /** Full command line as run (managed), or the detected command. */
  command: string;
  /** Working directory the process was launched in (may be '' when unknown). */
  cwd: string;
  /** cwd resolved to a git repo, when it maps to one. */
  repo?: ProcessRepo;
  kind: ProcessKind;
  status: ProcessStatus;
  origin: ProcessOrigin;
  /** OS pid — diagnostic only; may be undefined and changes across restarts. */
  pid?: number;
  /** Active port, when known (detected servers). */
  port?: number;
  /** What started this process (e.g. 'agent', 'user', 'external'). */
  source?: string;
  /** When the current run started. */
  startedAt: number;
  /** When the (most recent) run ended, if it has. */
  endedAt?: number;
  /** Exit code of the last finished run. */
  exitCode?: number;
  /** Last error captured, for failed processes. */
  lastError?: string;
  /** How many times this command has been launched. */
  runCount?: number;
  /** Renderer-only: a tab is currently open for this process. */
  hasOpenTab?: boolean;
  /** Renderer-only: this entry was launched from the command history. */
  fromHistory?: boolean;
}

/** Body for starting a managed process. */
export interface ProcessStartRequest {
  /** Command binary (e.g. "npm"). */
  command: string;
  args?: string[];
  /** Absolute working directory. Must be inside a registered repo for bridge calls. */
  cwd: string;
  env?: Record<string, string>;
  label?: string;
  kind?: ProcessKind;
}

export interface ProcessControlResult {
  success: boolean;
  error?: string;
}

export interface ProcessStartResult extends ProcessControlResult {
  process?: ProcessEntry;
}

/** IPC channel names for the process registry. */
export enum ProcessRegistryEvents {
  LIST = 'processes:list',
  START = 'processes:start',
  STOP = 'processes:stop',
  RESTART = 'processes:restart',
  REMOVE = 'processes:remove',
  LOGS = 'processes:logs',
  CHANGED = 'processes:changed',
}

export interface ProcessRegistryAPI {
  /** Snapshot of all entries (managed + detected). */
  list: () => Promise<ProcessEntry[]>;
  /** Start a managed process. */
  start: (request: ProcessStartRequest) => Promise<ProcessStartResult>;
  /** Stop (kill) a running managed process. */
  stop: (id: string) => Promise<ProcessControlResult>;
  /** Restart a managed process (re-run its command). */
  restart: (id: string) => Promise<ProcessStartResult>;
  /** Remove an entry from the list (only when not running). */
  remove: (id: string) => Promise<ProcessControlResult>;
  /** Captured stdout and stderr for a managed process. */
  logs: (id: string) => Promise<string[]>;
  /** Subscribe to registry changes; returns an unsubscribe function. */
  onChanged: (callback: (processes: ProcessEntry[]) => void) => () => void;
}
