import type { ChildProcessWithoutNullStreams } from 'child_process';

export type DevServerLifecycleStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopped'
  | 'error';

export interface DevServerDescriptor {
  /**
   * Unique descriptor identifier. When omitted a session scoped identifier will be generated.
   */
  id?: string;
  /** Command to execute (e.g. `npm`). */
  command: string;
  /** Optional command arguments (e.g. ['run', 'dev']). */
  args?: string[];
  /** Working directory for the process. */
  cwd: string;
  /** Additional environment variables for the process. */
  env?: Record<string, string>;
  /** Preferred port to expose the dev server on. */
  port?: number;
  /** Optional alternate port when the preferred port is unavailable. */
  fallbackPort?: number;
  /**
   * Regex pattern used to detect when the server is ready. Defaults to `"started"` heuristics.
   */
  readyPattern?: string;
  /** Timeout for readiness detection in milliseconds. */
  readyTimeoutMs?: number;
  /** Optional human readable name for the server. */
  label?: string;
  /**
   * URL template to use once the server is ready. `:port` tokens will be replaced with the actual port.
   * When omitted the URL defaults to `http://localhost:<port>`.
   */
  urlTemplate?: string;
  /** Optional build step executed before the main command (e.g. `npm run build-storybook`). */
  build?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
}

export interface DevServerProcessState {
  descriptor: DevServerDescriptor;
  process?: ChildProcessWithoutNullStreams | null;
  status: DevServerLifecycleStatus;
  /** Accumulated stdout/stderr lines streamed to the renderer. */
  logs: DevServerLogEntry[];
  /** Optional HTTP URL once the server is ready. */
  url?: string;
  /** Active port in use. */
  port?: number;
  /** Timestamp for when the server was started. */
  startedAt?: number;
  /** Timestamp for when readiness was detected. */
  readyAt?: number;
  /** Last error encountered when starting the server. */
  lastError?: string;
}

export interface DevServerLogEntry {
  sessionId: string;
  stream: 'stdout' | 'stderr';
  message: string;
  timestamp: number;
}

export interface DevServerStatusPayload {
  sessionId: string;
  status: DevServerLifecycleStatus;
  url?: string;
  port?: number;
  pid?: number;
  lastError?: string;
}
