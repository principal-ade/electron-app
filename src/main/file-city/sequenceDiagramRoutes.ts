/**
 * Express routes for pushing/clearing/inspecting File City sequence-diagram
 * payloads. Mounted on the Principal MCP Bridge.
 */

import type { Application, Request, Response } from 'express';
import type {
  SequenceDiagramPayload,
  SequenceEdge,
  FileCitySequenceEventDef,
  SequenceLayoutOptions,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { SequenceDiagramStore } from './sequenceDiagramStore';

interface ValidationFailure {
  ok: false;
  error: string;
}
interface ValidationSuccess {
  ok: true;
  payload: SequenceDiagramPayload;
}

function validateSnippet(
  eventId: string,
  snippet: unknown,
  sourcePath: unknown,
): string | null {
  if (!snippet || typeof snippet !== 'object') {
    return `event ${eventId}: snippet must be an object`;
  }
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    return `event ${eventId}: snippet requires a sourcePath on the event`;
  }
  const s = snippet as Record<string, unknown>;
  const kind = (s.kind as string | undefined) ?? 'slice';

  if (kind !== 'slice' && kind !== 'diff') {
    return `event ${eventId}: snippet.kind must be 'slice' or 'diff'`;
  }

  // Window props (start/end/focus/context) follow the same rules in both
  // variants — required for slice, optional for diff.
  const isPosInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 1;
  const isNonNegInt = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0;

  if (kind === 'slice') {
    if (!isPosInt(s.startLine)) {
      return `event ${eventId}: snippet.startLine must be a positive integer`;
    }
    if (!isPosInt(s.endLine)) {
      return `event ${eventId}: snippet.endLine must be a positive integer`;
    }
    if ((s.endLine as number) < (s.startLine as number)) {
      return `event ${eventId}: snippet.endLine must be >= startLine`;
    }
  } else {
    if (typeof s.oldContents !== 'string' || s.oldContents.length === 0) {
      return `event ${eventId}: diff snippet requires a non-empty oldContents string`;
    }
    if (s.newContents !== undefined && typeof s.newContents !== 'string') {
      return `event ${eventId}: diff snippet.newContents must be a string when provided`;
    }
    if (s.startLine !== undefined && !isPosInt(s.startLine)) {
      return `event ${eventId}: snippet.startLine must be a positive integer`;
    }
    if (s.endLine !== undefined && !isPosInt(s.endLine)) {
      return `event ${eventId}: snippet.endLine must be a positive integer`;
    }
    if (
      s.startLine !== undefined &&
      s.endLine !== undefined &&
      (s.endLine as number) < (s.startLine as number)
    ) {
      return `event ${eventId}: snippet.endLine must be >= startLine`;
    }
    if (
      s.diffStyle !== undefined &&
      s.diffStyle !== 'unified' &&
      s.diffStyle !== 'split'
    ) {
      return `event ${eventId}: snippet.diffStyle must be 'unified' or 'split'`;
    }
  }

  if (s.focusLine !== undefined && !isPosInt(s.focusLine)) {
    return `event ${eventId}: snippet.focusLine must be a positive integer`;
  }
  if (s.contextLines !== undefined && !isNonNegInt(s.contextLines)) {
    return `event ${eventId}: snippet.contextLines must be a non-negative integer`;
  }
  return null;
}

function validateLayoutOptions(
  raw: unknown,
): { ok: true; value: SequenceLayoutOptions | undefined } | ValidationFailure {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'layoutOptions must be an object' };
  }
  const r = raw as Record<string, unknown>;
  const result: SequenceLayoutOptions = {};
  if (r.laneOrder !== undefined) {
    if (
      !Array.isArray(r.laneOrder) ||
      !r.laneOrder.every((v) => typeof v === 'string')
    ) {
      return {
        ok: false,
        error: 'layoutOptions.laneOrder must be an array of strings',
      };
    }
    result.laneOrder = r.laneOrder as string[];
  }
  return { ok: true, value: result };
}

function validatePayload(body: unknown): ValidationFailure | ValidationSuccess {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.events) || b.events.length === 0) {
    return { ok: false, error: 'events must be a non-empty array' };
  }
  if (!Array.isArray(b.edges)) {
    return { ok: false, error: 'edges must be an array' };
  }
  if (b.id !== undefined && (typeof b.id !== 'string' || b.id.length === 0)) {
    return { ok: false, error: 'id must be a non-empty string when provided' };
  }

  const events = b.events as FileCitySequenceEventDef[];
  const ids = new Set<string>();
  for (const ev of events) {
    if (!ev || typeof ev.id !== 'string' || typeof ev.name !== 'string') {
      return { ok: false, error: 'every event must have string id and name' };
    }
    if (ids.has(ev.id)) {
      return { ok: false, error: `duplicate event id: ${ev.id}` };
    }
    ids.add(ev.id);
    if (ev.snippet !== undefined) {
      const snippetError = validateSnippet(ev.id, ev.snippet, ev.sourcePath);
      if (snippetError) return { ok: false, error: snippetError };
    }
  }

  const edges = b.edges as SequenceEdge[];
  for (const edge of edges) {
    if (
      !edge ||
      typeof edge.id !== 'string' ||
      typeof edge.fromEvent !== 'string' ||
      typeof edge.toEvent !== 'string'
    ) {
      return {
        ok: false,
        error: 'every edge must have string id, fromEvent, toEvent',
      };
    }
    if (!ids.has(edge.fromEvent) || !ids.has(edge.toEvent)) {
      return {
        ok: false,
        error: `edge ${edge.id} references unknown event id`,
      };
    }
  }

  const layoutResult = validateLayoutOptions(b.layoutOptions);
  if (!layoutResult.ok) return layoutResult;

  const payload: SequenceDiagramPayload = {
    events,
    edges,
    id: typeof b.id === 'string' ? b.id : undefined,
    title: typeof b.title === 'string' ? b.title : undefined,
    repositoryPath:
      typeof b.repositoryPath === 'string' ? b.repositoryPath : undefined,
    summary: typeof b.summary === 'string' ? b.summary : undefined,
    layoutOptions: layoutResult.value,
  };
  return { ok: true, payload };
}

export function registerSequenceDiagramRoutes(
  app: Application,
  store: SequenceDiagramStore,
): void {
  app.post('/api/file-city/sequence', async (req: Request, res: Response) => {
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
      const { payload, broadcastTo, evictedIds } = await store.set(
        result.payload,
        { activate },
      );
      res.json({
        success: true,
        id: payload.id,
        broadcastTo,
        evictedIds,
      });
    } catch (err) {
      console.error('[sequenceDiagramRoutes] set failed', err);
      res.status(500).json({ success: false, error: 'failed to persist' });
    }
  });

  // Library list — must come before `/:id` so it isn't treated as an id.
  app.get(
    '/api/file-city/sequence/library',
    async (req: Request, res: Response) => {
      const repositoryPath =
        typeof req.query.repositoryPath === 'string'
          ? req.query.repositoryPath
          : undefined;
      try {
        const result = await store.list(repositoryPath);
        res.json({ success: true, ...result });
      } catch (err) {
        console.error('[sequenceDiagramRoutes] list failed', err);
        res.status(500).json({ success: false, error: 'failed to list' });
      }
    },
  );

  app.post(
    '/api/file-city/sequence/activate',
    async (req: Request, res: Response) => {
      const id =
        req.body && typeof req.body === 'object' && typeof req.body.id === 'string'
          ? req.body.id
          : null;
      if (!id) {
        res
          .status(400)
          .json({ success: false, error: 'id (string) is required' });
        return;
      }
      try {
        const { payload, broadcastTo } = await store.activate(id);
        if (!payload) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        res.json({ success: true, broadcastTo });
      } catch (err) {
        console.error('[sequenceDiagramRoutes] activate failed', err);
        res.status(500).json({ success: false, error: 'failed to activate' });
      }
    },
  );

  app.delete(
    '/api/file-city/sequence/:id',
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      try {
        const { found } = await store.delete(id);
        if (!found) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        console.error('[sequenceDiagramRoutes] delete by id failed', err);
        res.status(500).json({ success: false, error: 'failed to delete' });
      }
    },
  );

  app.get(
    '/api/file-city/sequence/:id',
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
        console.error('[sequenceDiagramRoutes] load by id failed', err);
        res.status(500).json({ success: false, error: 'failed to load' });
      }
    },
  );

  app.delete('/api/file-city/sequence', async (req: Request, res: Response) => {
    const repositoryPath =
      typeof req.query.repositoryPath === 'string'
        ? req.query.repositoryPath
        : undefined;
    try {
      const broadcastTo = await store.clear(repositoryPath);
      res.json({ success: true, broadcastTo });
    } catch (err) {
      console.error('[sequenceDiagramRoutes] clear failed', err);
      res.status(500).json({ success: false, error: 'failed to clear' });
    }
  });

  app.get('/api/file-city/sequence', async (req: Request, res: Response) => {
    try {
      if (typeof req.query.repositoryPath === 'string') {
        const payload = await store.get(req.query.repositoryPath);
        res.json({ success: true, payload });
        return;
      }
      const payloads = await store.getAll();
      res.json({ success: true, payloads });
    } catch (err) {
      console.error('[sequenceDiagramRoutes] get failed', err);
      res.status(500).json({ success: false, error: 'failed to read' });
    }
  });
}
