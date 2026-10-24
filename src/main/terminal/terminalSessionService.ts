/**
 * Terminal session creation, shared by the renderer (TIPC) and the HTTP bridge.
 *
 * Both entry points must behave — and be observed — identically: same reuse
 * rules, same ownership claim, same `terminal.session.create` span. Keeping the
 * implementation here means the HTTP route is a faithful trigger for testing
 * the renderer's real path rather than a parallel one.
 */

import path from 'path';
import { BrowserWindow } from 'electron';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Context, Span } from '@opentelemetry/api';
import { getSessionManagerInstance } from './sessionManagerSingleton';
import { ownershipManager } from './TerminalOwnershipManager';
import { isPtyAvailable } from './utils/ptyLoader';
import { findReusableSession } from './sessionReuse';
import { getTracer } from '../telemetry';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import type { TerminalSessionMetadata } from '../../shared/tipc/terminalRouterTypes';
import { traceparentFromSpan } from '../../shared/telemetry/traceparent';

const tracer = getTracer('principal-ade-main');

export interface TerminalSessionCreateInput {
  cwd?: string;
  command?: string;
  context?: string;
  metadata?: TerminalSessionMetadata;
}

export interface TerminalSessionCreateResult {
  sessionId: string;
  /** True when an existing session for this context was reattached. */
  reused: boolean;
}

export type TerminalSessionCreateOrigin = 'renderer' | 'http';

/**
 * Broadcast terminal sessions list to all windows.
 * Called when sessions are created or destroyed, and from the
 * agent-session-events sidecar when a Claude SessionStart binds onto a tab.
 * Returns counts for telemetry.
 */
export function broadcastTerminalSessionsChanged(): {
  sessionsCount: number;
  windowsCount: number;
} {
  const sessionManager = getSessionManagerInstance();
  const sessions = Array.from(sessionManager.getAllSessions().entries()).map(
    ([id, session]) => {
      const owner = ownershipManager.getOwner(id);
      const ownerWindowId =
        owner && owner.type === 'local' ? parseInt(owner.id, 10) : undefined;
      return {
        id,
        cwd: session.directory,
        directory: session.directory,
        context: session.context,
        agentSessionId: session.agentSessionId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        cols: session.cols,
        rows: session.rows,
        status: 'active' as const,
        ownedByWindowId: ownerWindowId,
        metadata: session.metadata,
      };
    },
  );

  const allWindows = BrowserWindow.getAllWindows();
  let windowsCount = 0;

  allWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:sessions-changed', sessions);
      windowsCount++;
    }
  });

  return { sessionsCount: sessions.length, windowsCount };
}

/**
 * Broadcast the session list, swallowing transport errors: a failed broadcast
 * must never fail the terminal request that triggered it.
 */
function broadcastSessionListChanged(span: Span): void {
  try {
    const { sessionsCount, windowsCount } = broadcastTerminalSessionsChanged();
    span.addEvent('terminal.sessions.broadcast', {
      'sessions.count': sessionsCount,
      'windows.count': windowsCount,
    });
  } catch (err) {
    console.warn('[Terminal] Failed to broadcast session change:', err);
  }
}

/**
 * Stamp `lastOpenedAt` for the repository rooted exactly at `cwd`, so opening
 * a terminal tab feeds the same recency ordering as opening a repo window.
 *
 * Only an exact repo-root match counts: a terminal opened in a subdirectory or
 * outside any registered repository is ignored. Paths are normalised (absolute,
 * trailing separator stripped) before the lookup.
 *
 * Fire-and-forget — the caller does not await it, and a failure never blocks
 * the terminal tab.
 */
export async function stampOpenedRepository(cwd?: string): Promise<void> {
  if (!cwd) return;

  const span = tracer.startSpan('alexandria.terminal.update_last_opened');

  try {
    const normalized = path.resolve(cwd).replace(/[/\\]+$/, '');
    const registry = AlexandriaRegistryService.getInstance();
    const repository = await registry.getRepositoryByPath(normalized);

    if (!repository) {
      span.setStatus({ code: SpanStatusCode.OK });
      return;
    }

    span.setAttribute('repository_path', repository.path);
    await registry.updateLastOpened(repository.path);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    console.warn('[Terminal] Failed to update lastOpenedAt:', error);
    span.recordException(
      error instanceof Error ? error : new Error(String(error)),
    );
    span.setStatus({ code: SpanStatusCode.ERROR });
  } finally {
    span.end();
  }
}

/**
 * Create (or reattach to) a terminal session for `windowId`.
 *
 * Reuse: a live session with the same tab context is handed back instead of
 * spawning a second shell, so reopening a tab, moving it between windows, and
 * reattaching after an app restart all land on the surviving PTY. A command
 * request always gets a fresh session, since reusing one would re-run the
 * command in a live shell.
 */
export async function createTerminalSession(
  input: TerminalSessionCreateInput,
  windowId: number,
  origin: TerminalSessionCreateOrigin,
  parentContext?: Context | null,
): Promise<TerminalSessionCreateResult> {
  const sessionManager = getSessionManagerInstance();

  // Explicit parent: no OpenTelemetry context manager is registered, so active
  // context would be ignored and every span would start its own trace.
  const span = tracer.startSpan(
    'terminal.session.create',
    { attributes: { 'session.origin': origin, 'window.id': windowId } },
    parentContext ?? undefined,
  );

  try {
    if (!isPtyAvailable()) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'PTY not available',
      });
      throw new Error('Terminal functionality is not available in this build');
    }

    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'No window found',
      });
      throw new Error('No window found for terminal session');
    }

    const cwd = input.cwd || process.env.HOME || '/';

    if (!input.command) {
      const existing = findReusableSession(
        sessionManager.getAllSessions().values(),
        cwd,
        input.context,
      );
      if (existing) {
        span.setAttribute('session.id', existing.id);
        span.setAttribute('session.reused', true);
        span.addEvent('terminal.session.reused', {
          'session.id': existing.id,
          'window.id': window.id,
        });
        sessionManager.createMessageChannelForSession(existing.id, window.id);
        ownershipManager.claimOwnership(existing.id, window.id);
        broadcastSessionListChanged(span);

        // Reopening a tab counts as opening the repo, same as creating one.
        void stampOpenedRepository(input.cwd);

        span.setStatus({ code: SpanStatusCode.OK });
        return { sessionId: existing.id, reused: true };
      }
    }

    const canCreate = sessionManager.canCreateSession();

    // Event: request handled
    span.addEvent('terminal.session.router_handled', {
      'window.id': window.id,
      can_create: canCreate,
    });

    if (!canCreate) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Session limit reached',
      });
      throw new Error(
        `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached`,
      );
    }

    const sessionId = await sessionManager.createSession(
      cwd,
      input.context,
      input.command,
      input.metadata,
      traceparentFromSpan(span),
    );

    span.setAttribute('session.id', sessionId);

    span.addEvent('terminal.session.manager_action', {
      action: 'create',
      'session.id': sessionId,
    });

    span.addEvent('terminal.session.store_updated', {
      operation: 'set',
      'session.id': sessionId,
      'store.size': sessionManager.getAllSessions().size,
    });

    // Create MessageChannel and send port to renderer
    sessionManager.createMessageChannelForSession(sessionId, window.id);

    // Auto-claim ownership for the creating window
    const ownershipResult = ownershipManager.claimOwnership(
      sessionId,
      window.id,
    );
    console.log('[Terminal] Ownership claimed:', {
      sessionId,
      windowId: window.id,
      result: ownershipResult,
    });

    broadcastSessionListChanged(span);

    // Opening a terminal tab counts as opening the repo: stamp recency so it
    // shows up first in Quick Open / local project ordering. Fire-and-forget —
    // the tab is returned immediately.
    void stampOpenedRepository(input.cwd);

    span.setStatus({ code: SpanStatusCode.OK });
    return { sessionId, reused: false };
  } catch (error) {
    span.recordException(
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  } finally {
    span.end();
  }
}
