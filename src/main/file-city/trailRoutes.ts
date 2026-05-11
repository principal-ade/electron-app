/**
 * Express routes for pushing/clearing/inspecting File City trail payloads.
 * Mounted on the Principal MCP Bridge.
 *
 * Trail payloads do NOT carry a `repositoryPath` (the schema is
 * intentionally portable); host bucketing happens via a top-level
 * `repositoryPath` field on the request body which the persistence layer
 * stores on the index entry only.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Application, Request, Response } from 'express';
import type {
  TrailPayload,
  TrailMarker,
  TrailView,
  SequenceMarkerRef,
} from '@industry-theme/file-city-panel';
import { TrailStore, sendToRepoWindows } from './trailStore';
import { fetchSharedTrail } from './trailShare';
import {
  FileCityTrailEvent,
  TrailShareError,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { openDevWorkspaceWindow } from '../window/devWorkspaceWindowHandlers';
import { applicationWindows, specialWindows } from '../window/modernWindowManager';

type WindowOpened = 'focused' | 'created' | 'none';

async function ensureDevWorkspaceWindow(
  repositoryPath: string,
): Promise<WindowOpened> {
  const registry = AlexandriaRegistryService.getInstance();
  let entry = await registry.getRepositoryByPath(repositoryPath);
  if (!entry) {
    try {
      const stat = await fs.stat(path.join(repositoryPath, '.git'));
      if (!stat.isDirectory() && !stat.isFile()) return 'none';
    } catch {
      return 'none';
    }
    try {
      entry = await registry.registerRepository(repositoryPath);
    } catch (err) {
      console.error('[trailRoutes] auto-register failed', err);
      return 'none';
    }
  }

  const windowKey = `dev-workspace-${entry.path}`;
  const existingId = specialWindows.get(windowKey);
  const existingWindow =
    existingId !== undefined ? applicationWindows.get(existingId) : undefined;
  const aliveBefore = !!existingWindow && !existingWindow.window.isDestroyed();

  const result = await openDevWorkspaceWindow({ alexandriaEntry: entry });
  if (!result) return 'none';
  return aliveBefore ? 'focused' : 'created';
}

interface ValidationFailure {
  ok: false;
  error: string;
}
interface ValidationSuccess {
  ok: true;
  payload: TrailPayload;
  repositoryPath?: string;
}

const isPosInt = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1;
const isNonNegInt = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0;

function validateSnippet(
  markerId: string,
  snippet: unknown,
  sourcePath: unknown,
): string | null {
  if (!snippet || typeof snippet !== 'object') {
    return `marker ${markerId}: snippet must be an object`;
  }
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    return `marker ${markerId}: snippet requires a sourcePath on the marker`;
  }
  const s = snippet as Record<string, unknown>;
  const kind = s.kind;

  if (kind !== 'slice' && kind !== 'diff') {
    return `marker ${markerId}: snippet.kind must be 'slice' or 'diff'`;
  }

  if (kind === 'slice') {
    if (!isPosInt(s.startLine)) {
      return `marker ${markerId}: snippet.startLine must be a positive integer`;
    }
    if (!isPosInt(s.endLine)) {
      return `marker ${markerId}: snippet.endLine must be a positive integer`;
    }
    if ((s.endLine as number) < (s.startLine as number)) {
      return `marker ${markerId}: snippet.endLine must be >= startLine`;
    }
  } else {
    if (typeof s.oldContents !== 'string') {
      return `marker ${markerId}: diff snippet requires an oldContents string`;
    }
    if (s.newContents !== undefined && typeof s.newContents !== 'string') {
      return `marker ${markerId}: diff snippet.newContents must be a string when provided`;
    }
    if (!isPosInt(s.startLine)) {
      return `marker ${markerId}: diff snippet.startLine must be a positive integer`;
    }
    if (!isPosInt(s.endLine)) {
      return `marker ${markerId}: diff snippet.endLine must be a positive integer`;
    }
    if ((s.endLine as number) < (s.startLine as number)) {
      return `marker ${markerId}: diff snippet.endLine must be >= startLine`;
    }
    if (
      s.diffStyle !== undefined &&
      s.diffStyle !== 'unified' &&
      s.diffStyle !== 'split'
    ) {
      return `marker ${markerId}: snippet.diffStyle must be 'unified' or 'split'`;
    }
  }

  if (s.focusLine !== undefined && !isPosInt(s.focusLine)) {
    return `marker ${markerId}: snippet.focusLine must be a positive integer`;
  }
  if (s.contextLines !== undefined && !isNonNegInt(s.contextLines)) {
    return `marker ${markerId}: snippet.contextLines must be a non-negative integer`;
  }
  return null;
}

function validateView(view: unknown, markerIds: Set<string>): string | null {
  if (!view || typeof view !== 'object') return 'view must be an object';
  const v = view as Record<string, unknown>;
  if (typeof v.kind !== 'string') return 'view.kind must be a string';
  if (v.kind === 'sequence') {
    if (!Array.isArray(v.markers)) {
      return 'sequence view: markers must be an array';
    }
    for (const ref of v.markers as SequenceMarkerRef[]) {
      if (!ref || typeof ref.markerId !== 'string') {
        return 'sequence view: every marker ref must have a markerId';
      }
      if (!markerIds.has(ref.markerId)) {
        return `sequence view: unknown markerId ${ref.markerId}`;
      }
      if (typeof ref.name !== 'string') {
        return `sequence view marker ${ref.markerId}: name must be a string`;
      }
    }
    if (!Array.isArray(v.edges)) {
      return 'sequence view: edges must be an array';
    }
    for (const edge of v.edges as Array<Record<string, unknown>>) {
      if (
        !edge ||
        typeof edge.id !== 'string' ||
        typeof edge.fromEvent !== 'string' ||
        typeof edge.toEvent !== 'string'
      ) {
        return 'sequence view: every edge must have string id, fromEvent, toEvent';
      }
    }
  }
  // Other view kinds are declared in the schema but have no v1 renderer;
  // we accept them without strict validation.
  return null;
}

function validatePayload(body: unknown): ValidationFailure | ValidationSuccess {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.markers) || b.markers.length === 0) {
    return { ok: false, error: 'markers must be a non-empty array' };
  }
  if (!Array.isArray(b.views) || b.views.length === 0) {
    return { ok: false, error: 'views must be a non-empty array' };
  }
  if (typeof b.id !== 'string' || b.id.length === 0) {
    return { ok: false, error: 'id must be a non-empty string' };
  }
  if (typeof b.title !== 'string' || b.title.length === 0) {
    return { ok: false, error: 'title must be a non-empty string' };
  }

  const markers = b.markers as TrailMarker[];
  const ids = new Set<string>();
  for (const m of markers) {
    if (!m || typeof m.id !== 'string') {
      return { ok: false, error: 'every marker must have a string id' };
    }
    if (ids.has(m.id)) {
      return { ok: false, error: `duplicate marker id: ${m.id}` };
    }
    ids.add(m.id);
    if (m.snippet !== undefined) {
      const snippetError = validateSnippet(m.id, m.snippet, m.sourcePath);
      if (snippetError) return { ok: false, error: snippetError };
    }
  }

  for (const view of b.views as TrailView[]) {
    const viewError = validateView(view, ids);
    if (viewError) return { ok: false, error: viewError };
  }

  // Notes are user-authored content; never accept them from external HTTP
  // callers. The store preserves existing notes from disk when replacing a
  // payload by id, so re-pushes don't drop them.
  const now = new Date().toISOString();
  const payload: TrailPayload = {
    id: b.id,
    title: b.title,
    markers,
    views: b.views as TrailView[],
    summary: typeof b.summary === 'string' ? b.summary : undefined,
    kind: typeof b.kind === 'string' ? b.kind : undefined,
    repos: Array.isArray(b.repos) ? (b.repos as TrailPayload['repos']) : undefined,
    authoredAt:
      b.authoredAt && typeof b.authoredAt === 'object'
        ? (b.authoredAt as TrailPayload['authoredAt'])
        : undefined,
    createdAt: typeof b.createdAt === 'string' ? b.createdAt : now,
    updatedAt: typeof b.updatedAt === 'string' ? b.updatedAt : now,
  };

  const repositoryPath =
    typeof b.repositoryPath === 'string' ? b.repositoryPath : undefined;

  return { ok: true, payload, repositoryPath };
}

export function registerTrailRoutes(
  app: Application,
  store: TrailStore,
): void {
  app.post('/api/file-city/trail', async (req: Request, res: Response) => {
    const result = validatePayload(req.body);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    const activate =
      req.body && typeof req.body === 'object' && 'activate' in req.body
        ? req.body.activate !== false
        : true;
    try {
      const { payload, evictedIds } = await store.set(result.payload, {
        activate,
        repositoryPath: result.repositoryPath,
      });
      let windowOpened: WindowOpened = 'none';
      if (activate && result.repositoryPath) {
        try {
          windowOpened = await ensureDevWorkspaceWindow(result.repositoryPath);
        } catch (err) {
          console.error('[trailRoutes] ensure window failed', err);
        }
      }
      let broadcastTo = 0;
      if (activate) {
        broadcastTo = sendToRepoWindows(
          FileCityTrailEvent.PAYLOAD_SET,
          { payload, repositoryPath: result.repositoryPath },
          result.repositoryPath,
        );
      }
      sendToRepoWindows(
        FileCityTrailEvent.LIBRARY_CHANGED,
        { repositoryPath: result.repositoryPath },
        result.repositoryPath,
      );
      res.json({
        success: true,
        id: payload.id,
        broadcastTo,
        evictedIds,
        windowOpened,
      });
    } catch (err) {
      console.error('[trailRoutes] set failed', err);
      res.status(500).json({ success: false, error: 'failed to persist' });
    }
  });

  // Library list — must come before `/:id` so it isn't treated as an id.
  app.get(
    '/api/file-city/trail/library',
    async (req: Request, res: Response) => {
      const repositoryPath =
        typeof req.query.repositoryPath === 'string'
          ? req.query.repositoryPath
          : undefined;
      try {
        const result = await store.list(repositoryPath);
        res.json({ success: true, ...result });
      } catch (err) {
        console.error('[trailRoutes] list failed', err);
        res.status(500).json({ success: false, error: 'failed to list' });
      }
    },
  );

  app.post(
    '/api/file-city/trail/activate',
    async (req: Request, res: Response) => {
      const id =
        req.body && typeof req.body === 'object' && typeof req.body.id === 'string'
          ? req.body.id
          : null;
      if (!id) {
        res.status(400).json({ success: false, error: 'id (string) is required' });
        return;
      }
      try {
        const result = await store.activate(id);
        if (!result) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        const broadcastTo = sendToRepoWindows(
          FileCityTrailEvent.PAYLOAD_SET,
          { payload: result.payload, repositoryPath: result.repositoryPath },
          result.repositoryPath,
        );
        sendToRepoWindows(
          FileCityTrailEvent.LIBRARY_CHANGED,
          { repositoryPath: result.repositoryPath },
          result.repositoryPath,
        );
        res.json({ success: true, broadcastTo });
      } catch (err) {
        console.error('[trailRoutes] activate failed', err);
        res.status(500).json({ success: false, error: 'failed to activate' });
      }
    },
  );

  app.delete(
    '/api/file-city/trail/:id',
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      try {
        const { found, wasActive, repositoryPath } = await store.delete(id);
        if (!found) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        if (wasActive) {
          sendToRepoWindows(
            FileCityTrailEvent.PAYLOAD_CLEARED,
            { repositoryPath },
            repositoryPath,
          );
        }
        sendToRepoWindows(
          FileCityTrailEvent.LIBRARY_CHANGED,
          { repositoryPath },
          repositoryPath,
        );
        res.json({ success: true });
      } catch (err) {
        console.error('[trailRoutes] delete by id failed', err);
        res.status(500).json({ success: false, error: 'failed to delete' });
      }
    },
  );

  // Hydrate a private web-ade share by (owner, repo, id). The GitHub token
  // lives in the main process, so an external curl can't reach web-ade
  // directly — this route runs the authed fetch on the caller's behalf and
  // returns the full payload. Mounted before `/:id` for path specificity.
  app.get(
    '/api/file-city/trail/share/:owner/:repo/:id',
    async (req: Request, res: Response) => {
      const owner = String(req.params.owner);
      const repo = String(req.params.repo);
      const id = String(req.params.id);
      try {
        const result = await fetchSharedTrail(owner, repo, id);
        res.json({ success: true, payload: result.payload });
      } catch (err) {
        if (err instanceof TrailShareError) {
          const status = err.code === 'SHARE_NOT_FOUND' ? 404 : 502;
          res
            .status(status)
            .json({ success: false, error: err.message, code: err.code });
          return;
        }
        console.error('[trailRoutes] fetch shared failed', err);
        res
          .status(500)
          .json({ success: false, error: 'failed to fetch shared trail' });
      }
    },
  );

  app.get(
    '/api/file-city/trail/:id',
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      try {
        const payload = await store.loadById(id);
        if (!payload) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        res.json({ success: true, payload });
      } catch (err) {
        console.error('[trailRoutes] load by id failed', err);
        res.status(500).json({ success: false, error: 'failed to load' });
      }
    },
  );

  app.delete('/api/file-city/trail', async (req: Request, res: Response) => {
    const repositoryPath =
      typeof req.query.repositoryPath === 'string'
        ? req.query.repositoryPath
        : undefined;
    try {
      await store.clear(repositoryPath);
      const broadcastTo = sendToRepoWindows(
        FileCityTrailEvent.PAYLOAD_CLEARED,
        { repositoryPath },
        repositoryPath,
      );
      sendToRepoWindows(
        FileCityTrailEvent.LIBRARY_CHANGED,
        { repositoryPath },
        repositoryPath,
      );
      res.json({ success: true, broadcastTo });
    } catch (err) {
      console.error('[trailRoutes] clear failed', err);
      res.status(500).json({ success: false, error: 'failed to clear' });
    }
  });

  app.get('/api/file-city/trail', async (req: Request, res: Response) => {
    try {
      if (typeof req.query.repositoryPath === 'string') {
        const payload = await store.get(req.query.repositoryPath);
        res.json({ success: true, payload });
        return;
      }
      const payloads = await store.getAll();
      res.json({ success: true, payloads });
    } catch (err) {
      console.error('[trailRoutes] get failed', err);
      res.status(500).json({ success: false, error: 'failed to read' });
    }
  });
}
