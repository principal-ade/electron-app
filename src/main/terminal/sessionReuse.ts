/**
 * Session reuse rules for the terminal router.
 *
 * Opening a terminal is idempotent per tab: `createTerminalSession` must hand
 * back the existing session instead of spawning a second shell. Keeping the
 * rule in its own module makes it testable without Electron, TIPC, or a PTY.
 */

export interface ReusableSession {
  id: string;
  /** Working directory the session was created in. */
  directory: string;
  /** Tab identity (`<window context>:<tab context>`). */
  context?: string;
}

/**
 * Find a live session this request can reattach to instead of creating one.
 *
 * `context` is the tab's identity, so it is the primary key: two tabs in the
 * same directory are different terminals. A request without a context (an
 * older caller, or a session restored from the PTY daemon that predates
 * persisted contexts) falls back to an exact directory match among sessions
 * that also have no context.
 *
 * A context that matches nothing deliberately does not fall back to the
 * directory — that would hijack a different tab's shell.
 */
export function findReusableSession<T extends ReusableSession>(
  sessions: Iterable<T>,
  cwd: string,
  context?: string,
): T | undefined {
  if (context) {
    for (const session of sessions) {
      if (session.context === context) return session;
    }
    return undefined;
  }

  for (const session of sessions) {
    if (!session.context && session.directory === cwd) return session;
  }
  return undefined;
}
