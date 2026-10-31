/**
 * Express route for opening a document into the focused window.
 * Mounted on the Principal MCP Bridge.
 *
 * Documents are NOT routed by repo/topic to a specific window.
 * The doc opens in whichever window is *currently focused*, when that window
 * is one of the primary surfaces that can host a doc tab next to a tabbed
 * terminal — the principal window (Projects / Topics views) or the
 * dev-workspace. When nothing suitable is focused (app in the background, a
 * detached tab window in front, no window at all) the request falls back to
 * the principal window, focusing it or creating one, so a caller never has to
 * click into the app first.
 *
 * The main process can't see which *view* the principal window is showing, so
 * the final gate is renderer-side: each terminal framework subscribes to
 * `OPEN_DOCUMENT` only while it is mounted. If the target principal window is
 * on a non-terminal view (Settings, Auth…), nothing happens there.
 * `{ success: true, windowOpened: false }` is only returned when no window
 * could be resolved at all.
 *
 * Opening never writes to disk by default. Callers that want "open or create"
 * semantics opt in with `createIfMissing: true`, which creates the file (and
 * any missing parent directories) as an empty file before dispatch. An
 * existing file is never overwritten, and creation happens even when no
 * doc-capable window is focused — the response reports `created` either way.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import type { Application, Request, Response } from 'express';
import { DocumentEvent } from '../../shared/main-process-api-interfaces/DocumentAPI';
import {
  applicationWindows,
  focusOrCreateMainWindow,
} from '../window/modernWindowManager';
import type { IModernApplicationWindow } from '../window/types';
import { PrimaryWindowType } from '../window/types';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { isDocumentRange } from '../../shared/documentRange';

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
      createIfMissing?: unknown;
      range?: unknown;
    };

    const rawFilePath =
      typeof body.filePath === 'string' && body.filePath.length > 0
        ? body.filePath
        : undefined;
    if (!rawFilePath) {
      res.status(400).json({ success: false, error: 'filePath is required' });
      return;
    }

    if (
      body.createIfMissing !== undefined &&
      typeof body.createIfMissing !== 'boolean'
    ) {
      res.status(400).json({
        success: false,
        error: 'createIfMissing must be a boolean',
      });
      return;
    }
    const createIfMissing = body.createIfMissing === true;
    if (body.range !== undefined && !isDocumentRange(body.range)) {
      res.status(400).json({
        success: false,
        error: 'range must contain positive integer startLineNumber, startColumn, endLineNumber, and endColumn, with the end at or after the start',
      });
      return;
    }
    const range = body.range === undefined ? undefined : {
      startLineNumber: body.range.startLineNumber,
      startColumn: body.range.startColumn,
      endLineNumber: body.range.endLineNumber,
      endColumn: body.range.endColumn,
    };

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

    // Opt-in creation: only when the caller asked for it, so a mistyped path
    // in a plain open never litters the filesystem. Parent directories are
    // created too, mirroring "open or create" editor semantics. An existing
    // file (or a path that resolves to a directory) is never overwritten.
    let created = false;
    if (createIfMissing) {
      try {
        const existing = await fs.stat(absFilePath).catch(() => undefined);
        if (existing?.isDirectory()) {
          res.status(400).json({
            success: false,
            error: 'filePath points to a directory',
          });
          return;
        }
        if (!existing) {
          await fs.mkdir(path.dirname(absFilePath), { recursive: true });
          try {
            await fs.writeFile(absFilePath, '', { flag: 'wx' });
            created = true;
          } catch (error) {
            // Another writer won the race; the file exists, which is what
            // the caller asked for.
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          }
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? `Failed to create file: ${error.message}`
              : 'Failed to create file',
        });
        return;
      }
    }

    // Prefer the focused window when it hosts a tabbed terminal; otherwise
    // surface the principal window so the tab lands somewhere visible.
    const focused = BrowserWindow.getFocusedWindow();
    const focusedWindow =
      focused && !focused.isDestroyed()
        ? applicationWindows.get(focused.id)
        : undefined;
    const isDocCapable =
      !!focusedWindow &&
      DOC_CAPABLE_WINDOW_TYPES.has(focusedWindow.metadata?.primaryType);

    let appWindow: IModernApplicationWindow | null = isDocCapable
      ? focusedWindow
      : null;
    if (!appWindow) {
      try {
        appWindow = await focusOrCreateMainWindow();
      } catch (error) {
        console.error('[documentRoutes] main window fallback failed', error);
        appWindow = null;
      }
    }

    if (!appWindow || appWindow.window.isDestroyed()) {
      res.json({ success: true, windowOpened: false, created });
      return;
    }

    // A freshly created window drops IPC sent before its renderer loads.
    const { webContents } = appWindow.window;
    if (webContents.isLoading()) {
      await new Promise<void>((resolve) => {
        webContents.once('did-finish-load', () => resolve());
      });
    }

    webContents.send(DocumentEvent.OPEN_DOCUMENT, {
      filePath: absFilePath,
      repositoryPath,
      ...(range !== undefined ? { range } : {}),
    });

    res.json({ success: true, windowOpened: true, created });
  });
}
