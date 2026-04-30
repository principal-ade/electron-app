/**
 * Express routes for pushing/clearing/inspecting File City sequence-diagram
 * payloads. Mounted on the Principal MCP Bridge.
 */

import type { Application, Request, Response } from 'express';
import type {
  SequenceDiagramPayload,
  SequenceEdge,
  FileCitySequenceEventDef,
  SequenceEventSnippet,
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
  const s = snippet as Partial<SequenceEventSnippet>;
  if (!Number.isInteger(s.startLine) || (s.startLine as number) < 1) {
    return `event ${eventId}: snippet.startLine must be a positive integer`;
  }
  if (!Number.isInteger(s.endLine) || (s.endLine as number) < 1) {
    return `event ${eventId}: snippet.endLine must be a positive integer`;
  }
  if ((s.endLine as number) < (s.startLine as number)) {
    return `event ${eventId}: snippet.endLine must be >= startLine`;
  }
  if (
    s.focusLine !== undefined &&
    (!Number.isInteger(s.focusLine) || (s.focusLine as number) < 1)
  ) {
    return `event ${eventId}: snippet.focusLine must be a positive integer`;
  }
  if (
    s.contextLines !== undefined &&
    (!Number.isInteger(s.contextLines) || (s.contextLines as number) < 0)
  ) {
    return `event ${eventId}: snippet.contextLines must be a non-negative integer`;
  }
  return null;
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

  const payload: SequenceDiagramPayload = {
    events,
    edges,
    title: typeof b.title === 'string' ? b.title : undefined,
    repositoryPath:
      typeof b.repositoryPath === 'string' ? b.repositoryPath : undefined,
  };
  return { ok: true, payload };
}

export function registerSequenceDiagramRoutes(
  app: Application,
  store: SequenceDiagramStore,
): void {
  app.post('/api/file-city/sequence', (req: Request, res: Response) => {
    const result = validatePayload(req.body);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    const broadcastTo = store.set(result.payload);
    res.json({ success: true, broadcastTo });
  });

  app.delete('/api/file-city/sequence', (req: Request, res: Response) => {
    const repositoryPath =
      typeof req.query.repositoryPath === 'string'
        ? req.query.repositoryPath
        : undefined;
    const broadcastTo = store.clear(repositoryPath);
    res.json({ success: true, broadcastTo });
  });

  app.get('/api/file-city/sequence', (req: Request, res: Response) => {
    if (typeof req.query.repositoryPath === 'string') {
      const payload = store.get(req.query.repositoryPath);
      res.json({ success: true, payload });
      return;
    }
    res.json({ success: true, payloads: store.getAll() });
  });
}
