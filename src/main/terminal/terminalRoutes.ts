/**
 * Express routes for terminal sessions, mounted on the Principal MCP Bridge so
 * an agent (or a test harness) can open a real terminal at a repository and
 * observe the same telemetry the renderer produces.
 *
 * The bridge is local and unauthenticated, so the surface is constrained like
 * the process routes: `cwd` must be inside a registered Alexandria repository.
 * Sessions are created through the same service the renderer uses, so reuse
 * rules, ownership claims, and `terminal.session.create` spans are identical.
 */

import fs from 'fs';
import path from 'path';
import type { Application, Request, Response } from 'express';
import { BrowserWindow } from 'electron';
import { getSessionManagerInstance } from './sessionManagerSingleton';
import { createTerminalSession } from './terminalSessionService';
import { getProcessRegistry } from '../processes/ProcessRegistry';

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * The bridge has no renderer of its own, so it acts on the window a user would
 * consider "the app": the focused one, else the first live window.
 */
function resolveTargetWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  return (
    BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()) ?? null
  );
}

export function registerTerminalRoutes(app: Application): void {
  // List live terminal sessions.
  app.get('/api/terminals', (_req: Request, res: Response) => {
    const sessionManager = getSessionManagerInstance();
    const sessions = Array.from(sessionManager.getAllSessions().values()).map(
      (session) => ({
        id: session.id,
        cwd: session.directory,
        context: session.context,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        cols: session.cols,
        rows: session.rows,
      }),
    );
    res.json({ success: true, sessions });
  });

  // Open (or reattach to) a terminal session rooted at a repository.
  app.post('/api/terminals', async (req: Request, res: Response) => {
    const body = asObject(req.body);
    const cwd = body && typeof body.cwd === 'string' ? body.cwd.trim() : '';
    const context =
      body && typeof body.context === 'string' ? body.context.trim() : undefined;
    const command =
      body && typeof body.command === 'string' ? body.command.trim() : undefined;

    if (!cwd || !path.isAbsolute(cwd)) {
      res
        .status(400)
        .json({ success: false, error: 'body.cwd must be an absolute path' });
      return;
    }
    if (!fs.existsSync(cwd)) {
      res
        .status(400)
        .json({ success: false, error: `body.cwd does not exist: ${cwd}` });
      return;
    }

    // cwd must live inside a registered repository.
    const repo = await getProcessRegistry().resolveRepo(cwd);
    if (!repo) {
      res.status(400).json({
        success: false,
        error: `body.cwd is not inside a registered repository: ${cwd}`,
      });
      return;
    }

    const window = resolveTargetWindow();
    if (!window) {
      res
        .status(409)
        .json({ success: false, error: 'no live application window to own the terminal' });
      return;
    }

    try {
      const result = await createTerminalSession(
        { cwd, context, command },
        window.id,
        'http',
      );
      res.status(result.reused ? 200 : 201).json({
        success: true,
        sessionId: result.sessionId,
        reused: result.reused,
        windowId: window.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ success: false, error: message });
    }
  });

  // Close a terminal session (kills its PTY, in either backend).
  app.delete('/api/terminals/:id', async (req: Request, res: Response) => {
    const sessionManager = getSessionManagerInstance();
    const sessionId = String(req.params.id);
    if (!sessionManager.hasSession(sessionId)) {
      res.status(404).json({ success: false, error: 'unknown session id' });
      return;
    }
    await sessionManager.destroySession(sessionId);
    res.json({ success: true, sessionId });
  });
}
