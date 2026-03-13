/**
 * PTY Daemon Constants
 *
 * Shared configuration between daemon and client.
 */

import path from 'path';
import os from 'os';

// ============================================================================
// Socket Configuration
// ============================================================================

/**
 * Directory for daemon files (~/.principal/)
 */
export const DAEMON_DIR = path.join(os.homedir(), '.principal');

/**
 * Socket path for IPC communication.
 * Unix domain socket on macOS/Linux, named pipe on Windows.
 */
export const SOCKET_PATH =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\principal-pty-daemon'
    : path.join(DAEMON_DIR, 'pty-daemon.sock');

/**
 * PID file to track daemon process
 */
export const PID_FILE = path.join(DAEMON_DIR, 'pty-daemon.pid');

// ============================================================================
// Scrollback Configuration
// ============================================================================

/**
 * Maximum number of lines to keep in scrollback buffer per session.
 */
export const SCROLLBACK_LINES = 10000;

/**
 * Maximum bytes per scrollback buffer (safety limit).
 * ~10MB per session.
 */
export const SCROLLBACK_MAX_BYTES = 10 * 1024 * 1024;

// ============================================================================
// Timeouts & Intervals
// ============================================================================

/**
 * Idle timeout before daemon shuts down (30 minutes).
 * Daemon exits if no sessions AND no clients for this duration.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Health check interval for client ping/pong (30 seconds).
 */
export const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;

/**
 * Health check timeout - if no pong within this time, consider disconnected.
 */
export const HEALTH_CHECK_TIMEOUT_MS = 10 * 1000;

/**
 * Initial delay before reconnection attempt.
 */
export const RECONNECT_INITIAL_DELAY_MS = 1000;

/**
 * Maximum delay between reconnection attempts.
 */
export const RECONNECT_MAX_DELAY_MS = 30000;

/**
 * Backoff factor for exponential reconnection delay.
 */
export const RECONNECT_BACKOFF_FACTOR = 1.5;

/**
 * Maximum number of reconnection attempts before giving up.
 */
export const RECONNECT_MAX_ATTEMPTS = 10;

/**
 * Timeout for waiting for daemon to start (5 seconds).
 */
export const DAEMON_START_TIMEOUT_MS = 5000;

/**
 * Interval to poll for socket availability during daemon startup.
 */
export const DAEMON_START_POLL_INTERVAL_MS = 100;

// ============================================================================
// PTY Defaults
// ============================================================================

/**
 * Default terminal columns.
 */
export const DEFAULT_COLS = 80;

/**
 * Default terminal rows.
 */
export const DEFAULT_ROWS = 30;

/**
 * Terminal type for PTY.
 */
export const TERM_TYPE = 'xterm-256color';

// ============================================================================
// Logging
// ============================================================================

/**
 * Log levels for daemon.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Default log level.
 */
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';
