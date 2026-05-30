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
import {
  TrailStore,
  sendToPrincipalWindow,
  sendToRepoWindows,
  sendToTopicWindows,
} from './trailStore';
import { TrailLockedError } from './trailPersistence';
import type { TrailShowInPrincipalEnvelope } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { fetchSharedTrail } from './trailShare';
import {
  FileCityTrailEvent,
  TrailShareError,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { AlexandriaRegistryService } from '../stores/AlexandriaRegistryService';
import { TopicRegistryService } from '../stores/TopicRegistryService';
import { openDevWorkspaceWindow } from '../window/devWorkspaceWindowHandlers';
import {
  applicationWindows,
  focusOrCreateMainWindow,
  specialWindows,
} from '../window/modernWindowManager';

type WindowOpened = 'focused' | 'created' | 'routed-to-principal' | 'none';

async function ensureDevWorkspaceWindow(
  repositoryPath: string,
  openTrailId: string,
): Promise<WindowOpened> {
  const registry = AlexandriaRegistryService.getInstance();
  let entry = await registry.getRepositoryByPath(repositoryPath);
  if (!entry) {
    try {
      const stat = await fs.stat(path.join(repositoryPath, '.git'));
      if (!stat.isDirectory() && !stat.isFile()) {
        // No registered repo and no .git on disk — surface the trail in the
        // principal window instead of silently dropping it.
        const principal = await focusOrCreateMainWindow({ openTrailId });
        return principal ? 'routed-to-principal' : 'none';
      }
    } catch {
      const principal = await focusOrCreateMainWindow({ openTrailId });
      return principal ? 'routed-to-principal' : 'none';
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

  // Warm dev-workspace wins: focus it and let the broadcast (PAYLOAD_SET)
  // deliver the new trail. Cold dev-workspace yields to the principal
  // window — the user finds the trail at the top of TrailsView Recents
  // instead of getting a new dev-workspace spawned out from under them.
  if (aliveBefore) {
    const result = await openDevWorkspaceWindow({
      alexandriaEntry: entry,
      openTrailId,
    });
    return result ? 'focused' : 'none';
  }

  const principal = await focusOrCreateMainWindow({ openTrailId });
  if (principal) {
    // Warm-start handoff: cold starts pick the trail up from the URL hash
    // at mount, but a warm principal window never re-mounts, so push an
    // IPC asking it to switch to TrailsView. Cold starts also receive
    // this (harmlessly — the listener just re-sets activeView='trails').
    const envelope: TrailShowInPrincipalEnvelope = { trailId: openTrailId };
    sendToPrincipalWindow(
      FileCityTrailEvent.SHOW_IN_PRINCIPAL,
      envelope,
    );
  }
  return principal ? 'routed-to-principal' : 'none';
}

/**
 * Bring all open windows hosting `topicId` to the front. Topic windows
 * stamp `metadata.topicIds` from the backing `Workspace.topicIds` at open
 * time. Cold case (no warm window) returns 'none' so the caller can fall
 * back to repo/principal routing.
 */
async function ensureTopicWindow(topicId: string): Promise<WindowOpened> {
  let focused = false;
  for (const appWindow of applicationWindows.values()) {
    if (!appWindow.metadata?.topicIds?.includes(topicId)) continue;
    if (appWindow.window.isDestroyed()) continue;
    if (appWindow.window.isMinimized()) appWindow.window.restore();
    appWindow.window.show();
    appWindow.window.focus();
    appWindow.window.moveTop();
    focused = true;
  }
  return focused ? 'focused' : 'none';
}

interface ValidationFailure {
  ok: false;
  error: string;
}
interface ValidationSuccess {
  ok: true;
  payload: TrailPayload;
  repositoryPath?: string;
  topicId?: string;
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
  // `purpose` replaces the older free-form `kind` field (renamed in
  // @industry-theme/file-city-panel 0.5.81). The schema now restricts
  // it to a closed enum; we still accept the legacy `kind` value as a
  // soft alias so older producers don't break, but only when it maps
  // to a valid purpose. Unknown values are dropped (the default
  // behavior described on `TrailPayload.purpose` is to treat undefined
  // as 'investigation').
  const purposeCandidate =
    typeof b.purpose === 'string'
      ? b.purpose
      : typeof b.kind === 'string'
        ? b.kind
        : undefined;
  const purpose: TrailPayload['purpose'] =
    purposeCandidate === 'investigation' ||
    purposeCandidate === 'changelog' ||
    purposeCandidate === 'informative'
      ? purposeCandidate
      : undefined;

  // Subject-marker invariant. Mirrors web-ade's POST /api/trails rule
  // so producers fail fast in-app instead of round-tripping for the
  // 400. Investigation (the implicit default) needs exactly one marker
  // with kind:'subject'; other purposes must carry none.
  const effectivePurpose = purpose ?? 'investigation';
  const subjectMarkers = markers.filter((m) => m.kind === 'subject');
  if (effectivePurpose === 'investigation') {
    if (subjectMarkers.length !== 1) {
      return {
        ok: false,
        error: `investigation trails must have exactly one marker with kind:'subject' (found ${subjectMarkers.length})`,
      };
    }
  } else if (subjectMarkers.length > 0) {
    return {
      ok: false,
      error: `${effectivePurpose} trails must not have subject markers (found ${subjectMarkers.length})`,
    };
  }
  // `share` flags the trail as having an external audience and gates
  // the panel's review chrome. We accept it from HTTP because trails
  // can be authored as already-shared (e.g. agent publishes directly).
  // The shape is minimal (id only) in v1.
  const shareBody =
    b.share && typeof b.share === 'object'
      ? (b.share as Record<string, unknown>)
      : null;
  const share: TrailPayload['share'] =
    shareBody && typeof shareBody.id === 'string' && shareBody.id.length > 0
      ? { id: shareBody.id }
      : undefined;
  const payload: TrailPayload = {
    id: b.id,
    title: b.title,
    markers,
    views: b.views as TrailView[],
    summary: typeof b.summary === 'string' ? b.summary : undefined,
    purpose,
    share,
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
  const topicId =
    typeof b.topicId === 'string' && b.topicId.length > 0
      ? b.topicId
      : undefined;

  return { ok: true, payload, repositoryPath, topicId };
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
    try {
      const { payload, evictedIds } = await store.set(result.payload, {
        repositoryPath: result.repositoryPath,
      });
      // Persist the topic association first so listeners on the upcoming
      // PAYLOAD_SET/LIBRARY_CHANGED broadcasts see a consistent state.
      if (result.topicId) {
        try {
          await TopicRegistryService.getInstance().addTrailToTopic(
            result.topicId,
            payload.id,
          );
        } catch (err) {
          console.error('[trailRoutes] addTrailToTopic failed', err);
        }
      }
      // Topic routing wins when a warm topic window is available; only
      // fall back to the repo/principal path if no topic window is open.
      let windowOpened: WindowOpened = 'none';
      if (result.topicId) {
        try {
          windowOpened = await ensureTopicWindow(result.topicId);
        } catch (err) {
          console.error('[trailRoutes] ensure topic window failed', err);
        }
      }
      if (windowOpened === 'none' && result.repositoryPath) {
        try {
          windowOpened = await ensureDevWorkspaceWindow(
            result.repositoryPath,
            payload.id,
          );
        } catch (err) {
          console.error('[trailRoutes] ensure window failed', err);
        }
      }
      // PAYLOAD_SET routing: topic window wins. When the trail carries a
      // topicId and at least one workspace window for that topic is open,
      // the dev-workspace repo broadcast is suppressed so the trail
      // doesn't pop in two places. LIBRARY_CHANGED stays broadcast
      // everywhere — it's a cheap "your list changed, refresh" hint.
      const topicCount = sendToTopicWindows(
        FileCityTrailEvent.PAYLOAD_SET,
        { payload, repositoryPath: result.repositoryPath },
        result.topicId,
      );
      const repoCount =
        topicCount > 0
          ? 0
          : sendToRepoWindows(
              FileCityTrailEvent.PAYLOAD_SET,
              { payload, repositoryPath: result.repositoryPath },
              result.repositoryPath,
            );
      const broadcastTo = topicCount + repoCount;
      sendToRepoWindows(
        FileCityTrailEvent.LIBRARY_CHANGED,
        { repositoryPath: result.repositoryPath },
        result.repositoryPath,
      );
      sendToTopicWindows(
        FileCityTrailEvent.LIBRARY_CHANGED,
        { repositoryPath: result.repositoryPath },
        result.topicId,
      );
      sendToPrincipalWindow(FileCityTrailEvent.LIBRARY_CHANGED, {
        repositoryPath: result.repositoryPath,
      });
      res.json({
        success: true,
        id: payload.id,
        broadcastTo,
        evictedIds,
        windowOpened,
      });
    } catch (err) {
      if (err instanceof TrailLockedError) {
        // Shared trails are locked; re-authoring the id is not allowed.
        // 409 Conflict so callers (agents/skills re-POSTing) can tell this
        // apart from a transient 500 and stop retrying.
        res.status(409).json({ success: false, error: err.message });
        return;
      }
      console.error('[trailRoutes] set failed', err);
      res.status(500).json({
        success: false,
        error: `failed to persist: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // Fork an existing investigation into a new informative trail.
  // Body: { sourceId, payload, repositoryPath? }
  // The source must exist locally; the new payload's purpose is forced to
  // 'informative'; any kind:'subject' marker annotations are stripped (the
  // subject concept is investigation-only); the new id must differ from
  // the source. The host index records derivedFrom=sourceId so renderers
  // can show the link back.
  app.post(
    '/api/file-city/trail/fork-informative',
    async (req: Request, res: Response) => {
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : null;
      if (!body) {
        res
          .status(400)
          .json({ success: false, error: 'request body must be a JSON object' });
        return;
      }
      const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
      if (!sourceId) {
        res
          .status(400)
          .json({ success: false, error: 'sourceId (string) is required' });
        return;
      }
      const source = await store.loadById(sourceId);
      if (!source) {
        res.status(404).json({
          success: false,
          error: `source trail "${sourceId}" not found`,
        });
        return;
      }
      // Treat the nested payload as the same body shape validatePayload
      // already understands. Top-level repositoryPath wins over an
      // inner-payload one (unlikely to be set there, but be explicit).
      const innerPayload =
        body.payload && typeof body.payload === 'object'
          ? (body.payload as Record<string, unknown>)
          : null;
      if (!innerPayload) {
        res.status(400).json({
          success: false,
          error: 'payload (object) is required',
        });
        return;
      }
      const validation = validatePayload(innerPayload);
      if (!validation.ok) {
        res.status(400).json({ success: false, error: validation.error });
        return;
      }
      if (validation.payload.id === sourceId) {
        res.status(400).json({
          success: false,
          error: 'fork must use a new id distinct from sourceId',
        });
        return;
      }
      // Strip any kind:'subject' annotations — that field is
      // investigation-specific per the schema.
      const informativeMarkers = validation.payload.markers.map((m) => {
        if (m && (m as { kind?: unknown }).kind === 'subject') {
          const { kind: _drop, ...rest } = m as TrailMarker & {
            kind?: string;
          };
          return rest as TrailMarker;
        }
        return m;
      });
      const informativePayload: TrailPayload = {
        ...validation.payload,
        purpose: 'informative',
        markers: informativeMarkers,
      };
      const repositoryPath =
        typeof body.repositoryPath === 'string'
          ? body.repositoryPath
          : validation.repositoryPath;
      const topicId =
        typeof body.topicId === 'string' && body.topicId.length > 0
          ? body.topicId
          : validation.topicId;
      try {
        const { payload, evictedIds } = await store.set(informativePayload, {
          repositoryPath,
          derivedFrom: sourceId,
        });
        if (topicId) {
          try {
            await TopicRegistryService.getInstance().addTrailToTopic(
              topicId,
              payload.id,
            );
          } catch (err) {
            console.error(
              '[trailRoutes] addTrailToTopic failed (fork)',
              err,
            );
          }
        }
        let windowOpened: WindowOpened = 'none';
        if (topicId) {
          try {
            windowOpened = await ensureTopicWindow(topicId);
          } catch (err) {
            console.error(
              '[trailRoutes] ensure topic window failed (fork)',
              err,
            );
          }
        }
        if (windowOpened === 'none' && repositoryPath) {
          try {
            windowOpened = await ensureDevWorkspaceWindow(
              repositoryPath,
              payload.id,
            );
          } catch (err) {
            console.error(
              '[trailRoutes] ensure window failed (fork)',
              err,
            );
          }
        }
        // Topic window wins for PAYLOAD_SET — same rule as the create
        // route. LIBRARY_CHANGED still fans out everywhere.
        const topicCount = sendToTopicWindows(
          FileCityTrailEvent.PAYLOAD_SET,
          { payload, repositoryPath },
          topicId,
        );
        const repoCount =
          topicCount > 0
            ? 0
            : sendToRepoWindows(
                FileCityTrailEvent.PAYLOAD_SET,
                { payload, repositoryPath },
                repositoryPath,
              );
        const broadcastTo = topicCount + repoCount;
        sendToRepoWindows(
          FileCityTrailEvent.LIBRARY_CHANGED,
          { repositoryPath },
          repositoryPath,
        );
        sendToTopicWindows(
          FileCityTrailEvent.LIBRARY_CHANGED,
          { repositoryPath },
          topicId,
        );
        sendToPrincipalWindow(FileCityTrailEvent.LIBRARY_CHANGED, {
          repositoryPath,
        });
        res.json({
          success: true,
          id: payload.id,
          derivedFrom: sourceId,
          broadcastTo,
          evictedIds,
          windowOpened,
        });
      } catch (err) {
        console.error('[trailRoutes] fork-informative failed', err);
        res.status(500).json({
          success: false,
          error: `failed to persist fork: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

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
        const result = await store.loadByIdWithRepoPath(id);
        if (!result) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        let windowOpened: WindowOpened = 'none';
        if (result.repositoryPath) {
          try {
            windowOpened = await ensureDevWorkspaceWindow(
              result.repositoryPath,
              result.payload.id,
            );
          } catch (err) {
            console.error('[trailRoutes] ensure window failed', err);
          }
        }
        const broadcastTo = sendToRepoWindows(
          FileCityTrailEvent.PAYLOAD_SET,
          { payload: result.payload, repositoryPath: result.repositoryPath },
          result.repositoryPath,
        );
        res.json({ success: true, broadcastTo, windowOpened });
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
        const { found, repositoryPath } = await store.delete(id);
        if (!found) {
          res.status(404).json({ success: false, error: 'unknown id' });
          return;
        }
        sendToRepoWindows(
          FileCityTrailEvent.PAYLOAD_CLEARED,
          { id, repositoryPath },
          repositoryPath,
        );
        sendToRepoWindows(
          FileCityTrailEvent.LIBRARY_CHANGED,
          { repositoryPath },
          repositoryPath,
        );
        sendToPrincipalWindow(FileCityTrailEvent.LIBRARY_CHANGED, {
          repositoryPath,
        });
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

}
