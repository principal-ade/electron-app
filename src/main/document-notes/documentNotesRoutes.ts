/**
 * Express routes for user-authored markdown document notes.
 * Mounted on the Principal MCP Bridge so agents can fetch / mutate notes
 * for a specific markdown document via HTTP.
 */

import type { Application, Request, Response } from 'express';
import type { TextQuoteAnchor } from '../../shared/types/document-notes.types';
import { DocumentNotesPersistence } from './documentNotesPersistence';

function strQuery(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseAnchor(raw: unknown): TextQuoteAnchor | string {
  if (!raw || typeof raw !== 'object') {
    return 'anchor must be an object';
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.exact !== 'string' || r.exact.length === 0) {
    return 'anchor.exact must be a non-empty string';
  }
  const anchor: TextQuoteAnchor = { exact: r.exact };
  if (r.prefix !== undefined) {
    if (typeof r.prefix !== 'string') {
      return 'anchor.prefix must be a string when provided';
    }
    anchor.prefix = r.prefix;
  }
  if (r.suffix !== undefined) {
    if (typeof r.suffix !== 'string') {
      return 'anchor.suffix must be a string when provided';
    }
    anchor.suffix = r.suffix;
  }
  return anchor;
}

export function registerDocumentNotesRoutes(
  app: Application,
  store: DocumentNotesPersistence,
): void {
  // Library list — must come before `/:noteId` so it isn't treated as an id.
  app.get(
    '/api/document-notes/library',
    async (req: Request, res: Response) => {
      const repositoryPath = strQuery(req.query.repositoryPath);
      try {
        const entries = await store.listAllFiles(repositoryPath);
        res.json({ success: true, entries });
      } catch (err) {
        console.error('[documentNotesRoutes] library failed', err);
        res.status(500).json({ success: false, error: 'failed to list' });
      }
    },
  );

  // GET notes for a single file
  app.get('/api/document-notes', async (req: Request, res: Response) => {
    const repositoryPath = strQuery(req.query.repositoryPath);
    const relativeFilePath = strQuery(req.query.relativeFilePath);
    if (!relativeFilePath) {
      res
        .status(400)
        .json({ success: false, error: 'relativeFilePath is required' });
      return;
    }
    try {
      const notes = await store.listForFile(repositoryPath, relativeFilePath);
      res.json({ success: true, repositoryPath, relativeFilePath, notes });
    } catch (err) {
      console.error('[documentNotesRoutes] read failed', err);
      res.status(500).json({ success: false, error: 'failed to read' });
    }
  });

  // Create a note
  app.post('/api/document-notes', async (req: Request, res: Response) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      res
        .status(400)
        .json({ success: false, error: 'request body must be a JSON object' });
      return;
    }
    const b = body as Record<string, unknown>;
    const repositoryPath =
      typeof b.repositoryPath === 'string' ? b.repositoryPath : undefined;
    const relativeFilePath =
      typeof b.relativeFilePath === 'string' ? b.relativeFilePath : '';
    if (!relativeFilePath) {
      res
        .status(400)
        .json({ success: false, error: 'relativeFilePath is required' });
      return;
    }
    if (typeof b.body !== 'string' || b.body.length === 0) {
      res
        .status(400)
        .json({ success: false, error: 'body must be a non-empty string' });
      return;
    }
    const anchor = parseAnchor(b.anchor);
    if (typeof anchor === 'string') {
      res.status(400).json({ success: false, error: anchor });
      return;
    }
    const author = typeof b.author === 'string' ? b.author : undefined;
    try {
      const note = await store.createNote(repositoryPath, relativeFilePath, {
        anchor,
        body: b.body,
        author,
      });
      res.json({ success: true, note });
    } catch (err) {
      console.error('[documentNotesRoutes] create failed', err);
      res.status(500).json({ success: false, error: 'failed to create' });
    }
  });

  // Update a note's body
  app.patch(
    '/api/document-notes/:noteId',
    async (req: Request, res: Response) => {
      const noteId = String(req.params.noteId);
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({
          success: false,
          error: 'request body must be a JSON object',
        });
        return;
      }
      const b = body as Record<string, unknown>;
      const repositoryPath =
        typeof b.repositoryPath === 'string' ? b.repositoryPath : undefined;
      const relativeFilePath =
        typeof b.relativeFilePath === 'string' ? b.relativeFilePath : '';
      if (!relativeFilePath) {
        res.status(400).json({
          success: false,
          error: 'relativeFilePath is required',
        });
        return;
      }
      if (typeof b.body !== 'string') {
        res
          .status(400)
          .json({ success: false, error: 'body must be a string' });
        return;
      }
      try {
        const note = await store.updateNote(
          repositoryPath,
          relativeFilePath,
          noteId,
          b.body,
        );
        if (!note) {
          res.status(404).json({ success: false, error: 'unknown note id' });
          return;
        }
        res.json({ success: true, note });
      } catch (err) {
        console.error('[documentNotesRoutes] update failed', err);
        res.status(500).json({ success: false, error: 'failed to update' });
      }
    },
  );

  // Delete a note
  app.delete(
    '/api/document-notes/:noteId',
    async (req: Request, res: Response) => {
      const noteId = String(req.params.noteId);
      const repositoryPath = strQuery(req.query.repositoryPath);
      const relativeFilePath = strQuery(req.query.relativeFilePath);
      if (!relativeFilePath) {
        res.status(400).json({
          success: false,
          error: 'relativeFilePath is required',
        });
        return;
      }
      try {
        const removed = await store.deleteNote(
          repositoryPath,
          relativeFilePath,
          noteId,
        );
        if (!removed) {
          res.status(404).json({ success: false, error: 'unknown note id' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        console.error('[documentNotesRoutes] delete failed', err);
        res.status(500).json({ success: false, error: 'failed to delete' });
      }
    },
  );
}
