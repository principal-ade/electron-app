/**
 * Express route for opening a document into the focused window.
 * Mounted on the Principal MCP Bridge.
 *
 * Documents are NOT routed by repo/topic to a specific window.
 * The contract is deliberately narrow: open the doc in whichever window is
 * *currently focused*, when that window is one of the primary surfaces that
 * can host a doc tab next to a tabbed terminal — the principal window
 * (Projects / Topics views) or the dev-workspace.
 *
 * The main process can't see which *view* the principal window is showing, so
 * the final gate is renderer-side: each terminal framework subscribes to
 * `OPEN_DOCUMENT` only while it is mounted. If the focused principal window is
 * on a non-terminal view (Settings, Auth…), nothing happens there. A focused
 * window of any other type (or no focus) is a no-op:
 * `{ success: true, windowOpened: false }`.
 *
 * There is no cold-start path. The route only ever targets an already-open,
 * already-focused window via a warm IPC push (`DocumentEvent.OPEN_DOCUMENT`).
 */

import path from 'path';
import { BrowserWindow } from 'electron';
import type { Application, Request, Response } from 'express';
import { DocumentEvent } from '../../shared/main-process-api-interfaces/DocumentAPI';
import { applicationWindows } from '../window/modernWindowManager';
import { PrimaryWindowType } from '../window/types';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';

/**
 * Primary window types that can host a doc tab next to a tabbed terminal:
 * the principal window (MAIN — Projects/Topics views) and the dev-workspace.
 * Gating on `primaryType` rather than the
 * `features.terminalManager` boolean, which is an unreliable proxy (set on
 * MAIN, unset on the WORKSPACE window that actually renders a terminal).
 * This is a coarse gate — within the MAIN window the active view decides,
 * renderer-side, whether the doc actually lands.
 */
const DOC_CAPABLE_WINDOW_TYPES: ReadonlySet<PrimaryWindowType> = new Set([
  PrimaryWindowType.MAIN,
  PrimaryWindowType.DEV_WORKSPACE,
]);

export function registerDocumentRoutes(app: Application): void {
  app.post('/api/document/open', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      filePath?: unknown;
      repositoryPath?: unknown;
    };

    const rawFilePath =
      typeof body.filePath === 'string' && body.filePath.length > 0
        ? body.filePath
        : undefined;
    if (!rawFilePath) {
      res
        .status(400)
        .json({ success: false, error: 'filePath is required' });
      return;
    }

    const repositoryPath =
      typeof body.repositoryPath === 'string' && body.repositoryPath.length > 0
        ? body.repositoryPath
        : undefined;

    // Resolve to an absolute path. A repo-relative filePath is resolved
    // against the (registered or literal) repositoryPath; an already-absolute
    // filePath is used as-is.
    let absFilePath = rawFilePath;
    if (!path.isAbsolute(rawFilePath)) {
      if (!repositoryPath) {
        res.status(400).json({
          success: false,
          error:
            'filePath is relative; repositoryPath is required to resolve it',
        });
        return;
      }
      let repoRoot = repositoryPath;
      try {
        const entry =
          await AlexandriaRegistryService.getInstance().getRepositoryByPath(
            repositoryPath,
          );
        if (entry?.path) repoRoot = entry.path;
      } catch {
        // Fall back to the literal repositoryPath.
      }
      absFilePath = path.resolve(repoRoot, rawFilePath);
    }

    // Find the focused window; open only if it hosts a tabbed terminal.
    const focused = BrowserWindow.getFocusedWindow();
    const appWindow =
      focused && !focused.isDestroyed()
        ? applicationWindows.get(focused.id)
        : undefined;

    const isDocCapable =
      !!appWindow &&
      DOC_CAPABLE_WINDOW_TYPES.has(appWindow.metadata?.primaryType);

    if (!appWindow || !isDocCapable) {
      res.json({ success: true, windowOpened: false });
      return;
    }

    appWindow.window.webContents.send(DocumentEvent.OPEN_DOCUMENT, {
      filePath: absFilePath,
      repositoryPath,
    });

    res.json({ success: true, windowOpened: true });
  });
}
