/**
 * Disk-backed store for File City trail payloads, plus the IPC surface
 * that backs the `mainProcess.fileCityTrail` API in the renderer and a
 * targeted-send helper used by the HTTP routes to push state into
 * renderer windows that didn't initiate the change.
 *
 * Architecture note: store methods do **not** broadcast. They return rich
 * values so IPC callers (renderer-initiated mutations) update their own
 * state from the response. HTTP route handlers, which can't rely on the
 * caller already having the result, use `sendToRepoWindows()` after a
 * mutation to push to renderer windows scoped to the affected repo.
 * Exception: the note IPC handlers fan out LIBRARY_CHANGED after the
 * mutation — notes are the one IPC write path with cross-window readers
 * (any LocalTrailTabContent re-fetches off that hint), and the initiating
 * caller's inline update alone would leave them stale.
 */

import { ipcMain } from 'electron';
import * as crypto from 'crypto';
import {
  FileCityTrailEvent,
  TrailShareError,
  type FileCityTrailFetchSharedByIdResult,
  type FileCityTrailFetchSharedResult,
  type FileCityTrailShareResult,
  type TrailIndexEntry,
  type TrailListSharedOptions,
  type TrailListSharedResult,
  type TrailShareEnvelope,
  type TrailShareOptions,
} from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type {
  TrailPayload,
  TrailNote,
  TrailNoteDraft,
} from '@industry-theme/file-city-panel';
import { TrailPersistence } from './trailPersistence';
import {
  createSharedTrailNote,
  fetchSharedTrail,
  fetchSharedTrailById,
  listSharedTrails,
  shareTrail,
} from './trailShare';
import { requireHostedFeature } from '../services/FeatureAvailabilityService';
import { applicationWindows, getMainWindowId } from '../window/types';

export interface SetOptions {
  /**
   * Host-private filesystem path the trail belongs to. Persisted on the
   * index entry only; never written into the portable trail payload.
   */
  repositoryPath?: string;
  /**
   * Source trail id this entry was forked from (e.g. an investigation
   * converted to an informative trail). Stamped on the index entry only.
   * Preserved across re-POSTs; pass undefined on regular updates.
   */
  derivedFrom?: string;
}

export interface SetResult {
  payload: TrailPayload;
  evictedIds: string[];
}

export class TrailStore {
  private persistence = new TrailPersistence();

  async set(
    incoming: TrailPayload,
    options: SetOptions = {},
  ): Promise<SetResult> {
    const { payload, evictedIds } = await this.persistence.save(incoming, {
      repositoryPath: options.repositoryPath,
      derivedFrom: options.derivedFrom,
    });
    return { payload, evictedIds };
  }

  /**
   * Load a payload + its host-private `repositoryPath` by id. Used by the
   * activate route handler to broadcast and open a window without callers
   * needing to chain two reads.
   */
  loadByIdWithRepoPath(
    id: string,
  ): Promise<{ payload: TrailPayload; repositoryPath?: string } | null> {
    return this.persistence.loadByIdWithRepoPath(id);
  }

  async delete(id: string): Promise<{
    found: boolean;
    repositoryPath: string | undefined;
  }> {
    const result = await this.persistence.deleteById(id);
    if (!result) {
      return { found: false, repositoryPath: undefined };
    }
    return { found: true, repositoryPath: result.repositoryPath };
  }

  loadById(id: string): Promise<TrailPayload | null> {
    return this.persistence.loadById(id);
  }

  /** Absolute on-disk path of a saved trail's payload JSON, or null. */
  getFilePath(id: string): Promise<string | null> {
    return this.persistence.getFilePathById(id);
  }

  list(repositoryPath?: string): Promise<{
    entries: TrailIndexEntry[];
  }> {
    return this.persistence.listEntries(repositoryPath);
  }

  async createNote(
    payloadId: string,
    draft: TrailNoteDraft,
  ): Promise<TrailNote> {
    const now = new Date().toISOString();
    const note: TrailNote = {
      ...draft,
      id: `note-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = await this.persistence.applyToPayload(payloadId, (p) => ({
      ...p,
      notes: [...(p.notes ?? []), note],
    }));
    if (!updated) {
      throw new Error(`trail ${payloadId} not found`);
    }
    return note;
  }

  async updateNote(
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<TrailNote> {
    let edited: TrailNote | null = null;
    const updated = await this.persistence.applyToPayload(payloadId, (p) => {
      const existing = (p.notes ?? []).find((n) => n.id === noteId);
      if (!existing) return p;
      const next = { ...existing, body, updatedAt: new Date().toISOString() };
      edited = next;
      return {
        ...p,
        notes: (p.notes ?? []).map((n) => (n.id === noteId ? next : n)),
      };
    });
    if (!updated || !edited) {
      throw new Error(`note ${noteId} not found on trail ${payloadId}`);
    }
    return edited;
  }

  async deleteNote(payloadId: string, noteId: string): Promise<void> {
    const updated = await this.persistence.applyToPayload(payloadId, (p) => ({
      ...p,
      notes: (p.notes ?? []).filter((n) => n.id !== noteId),
    }));
    if (!updated) {
      throw new Error(`trail ${payloadId} not found`);
    }
  }

  async share(
    id: string,
    options?: TrailShareOptions,
  ): Promise<FileCityTrailShareResult> {
    await requireHostedFeature('trailTopicSharingAndInbox');
    // Create-once: a trail publishes to web-ade exactly once. If this id was
    // already shared, reuse that publication instead of minting a second
    // web-ade id — every POST /api/trails mints a fresh id, and each id has
    // its own anon-notes side-table and inbox deliveries, so notes/sends made
    // against the first publication are invisible from a second one (the
    // source of the inbox-shows-0-notes divergence). A deliberate re-publish
    // belongs behind an explicit "regenerate share" action, not here.
    const existing = await this.persistence.loadEntryById(id);
    if (existing?.sharedAt && existing.sharedUrl) {
      const reused = await this.resolveExistingShare(
        existing.sharedUrl,
        options?.repositoryPath ?? existing.repositoryPath,
      );
      if (reused) return reused;
      // Prior publication couldn't be resolved (e.g. deleted on web-ade) —
      // fall through and publish a fresh one, re-stamping the entry below.
    }

    const result = await shareTrail(
      {
        loadPayload: (payloadId) => this.persistence.loadById(payloadId),
        loadEntry: (payloadId) => this.persistence.loadEntryById(payloadId),
      },
      id,
      options,
    );
    // Keep the local copy but lock it: stamp `sharedAt`/`sharedUrl` on the
    // index entry. Subsequent content re-POSTs of this id are rejected by
    // `save` (TrailLockedError → 409); notes still flow via applyToPayload.
    await this.persistence.markShared(id, result.url);
    return result;
  }

  /**
   * Resolve an already-published share back into a `FileCityTrailShareResult`
   * from its persisted `sharedUrl`, without re-publishing. The web-ade id is
   * the trailing `/trail/{id}` path segment; the index entry is pulled from
   * the repo's shared list. Returns null when the id can't be parsed or the
   * share is no longer listed, so the caller can fall back to a fresh publish.
   */
  private async resolveExistingShare(
    sharedUrl: string,
    repositoryPath?: string,
  ): Promise<FileCityTrailShareResult | null> {
    const lastSegment = sharedUrl.split('/').filter(Boolean).pop();
    const shareId = lastSegment ? lastSegment.split(/[?#]/)[0] : null;
    if (!shareId) return null;
    try {
      const { entries } = await this.listShared(
        repositoryPath ? { repositoryPath } : undefined,
      );
      const entry = entries.find((e) => e.id === shareId);
      if (!entry) return null;
      return { url: sharedUrl, id: shareId, entry };
    } catch {
      return null;
    }
  }

  listShared(
    options?: TrailListSharedOptions,
  ): Promise<TrailListSharedResult> {
    return requireHostedFeature('trailTopicSharingAndInbox').then(() =>
      listSharedTrails(options),
    );
  }

  fetchShared(
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCityTrailFetchSharedResult> {
    return requireHostedFeature('trailTopicSharingAndInbox').then(() =>
      fetchSharedTrail(owner, repo, id),
    );
  }

  fetchSharedById(id: string): Promise<FileCityTrailFetchSharedByIdResult> {
    return requireHostedFeature('trailTopicSharingAndInbox').then(() =>
      fetchSharedTrailById(id),
    );
  }

  /**
   * Create a note on a published trail via web-ade. The remote counterpart to
   * `createNote`, for inbox/shared trails whose payloads aren't in the local
   * disk store. Persistence + id/timestamp assignment happen server-side.
   */
  createSharedNote(id: string, draft: TrailNoteDraft): Promise<TrailNote> {
    return requireHostedFeature('trailTopicSharingAndInbox').then(() =>
      createSharedTrailNote(id, draft),
    );
  }

  /**
   * Render a payload via PAYLOAD_SET targeted at a specific repo's
   * windows, without persisting locally. Renderer flow uses this to
   * preview a fetched-but-unsaved shared trail without writing through.
   */
  setTransient(
    payload: TrailPayload,
    repositoryPath: string | undefined,
  ): { sentTo: number } {
    const sentTo = sendToRepoWindows(
      FileCityTrailEvent.PAYLOAD_SET,
      { payload, repositoryPath },
      repositoryPath,
    );
    return { sentTo };
  }
}

async function shareEnvelope<T>(
  fn: () => Promise<T>,
): Promise<TrailShareEnvelope<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof TrailShareError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details,
      };
    }
    console.error('[TrailStore] share IPC failed', err);
    return {
      ok: false,
      code: 'WEB_ADE_ERROR',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Push an IPC event to renderer windows scoped to a specific
 * `repositoryPath`. Used by HTTP route handlers (and the transient
 * preview path) to notify other windows of state changes they didn't
 * initiate. IPC mutation handlers do **not** use this — their callers
 * receive the result inline and update their own state.
 *
 * If `repositoryPath` is undefined, sends nothing — a state change with
 * no repo bucket has no window to address. Returns the number of
 * windows the event was delivered to.
 */
export function sendToRepoWindows(
  eventName: FileCityTrailEvent,
  payload: unknown,
  repositoryPath: string | undefined,
): number {
  if (!repositoryPath) return 0;
  let delivered = 0;
  for (const appWindow of applicationWindows.values()) {
    if (appWindow.metadata?.localPath !== repositoryPath) continue;
    if (appWindow.window.isDestroyed()) continue;
    appWindow.window.webContents.send(eventName, payload);
    delivered += 1;
  }
  return delivered;
}

/**
 * Push an IPC event to the principal window. The principal window doesn't
 * carry a repo `localPath`, so `sendToRepoWindows` skips it — but it hosts
 * the cross-repo `TrailsView` Recents listener and needs `LIBRARY_CHANGED`
 * to refresh when a trail is created via the bridge with no live
 * dev-workspace for that repo. Returns 1 if delivered, 0 otherwise.
 */
export function sendToPrincipalWindow(
  eventName: FileCityTrailEvent,
  payload: unknown,
): number {
  const mainId = getMainWindowId();
  if (mainId === null) return 0;
  const appWindow = applicationWindows.get(mainId);
  if (!appWindow || appWindow.window.isDestroyed()) return 0;
  appWindow.window.webContents.send(eventName, payload);
  return 1;
}

/**
 * Fan LIBRARY_CHANGED out to every window that could be rendering the
 * trail: its repo's dev-workspace windows and the principal window. Only
 * LIBRARY_CHANGED is sent — never PAYLOAD_SET, whose consumers open/focus trail tabs; a
 * background persistence hint must not move UI. Fire-and-forget: callers
 * don't await, and failures only log.
 *
 */
async function broadcastLibraryChangedForTrail(
  store: TrailStore,
  trailId: string,
): Promise<void> {
  try {
    const loaded = await store.loadByIdWithRepoPath(trailId);
    const repositoryPath = loaded?.repositoryPath;
    sendToRepoWindows(
      FileCityTrailEvent.LIBRARY_CHANGED,
      { repositoryPath },
      repositoryPath,
    );
    sendToPrincipalWindow(FileCityTrailEvent.LIBRARY_CHANGED, {
      repositoryPath,
    });
  } catch (err) {
    console.error(
      '[TrailStore] LIBRARY_CHANGED broadcast failed for trail',
      trailId,
      err,
    );
  }
}

let singleton: TrailStore | null = null;

export function getTrailStore(): TrailStore {
  if (!singleton) {
    singleton = new TrailStore();
  }
  return singleton;
}

export function registerTrailHandlers(): void {
  const store = getTrailStore();
  ipcMain.handle(
    FileCityTrailEvent.LIST,
    (_event, repositoryPath?: string) => store.list(repositoryPath),
  );
  ipcMain.handle(FileCityTrailEvent.LOAD, (_event, id: string) =>
    store.loadById(id),
  );
  ipcMain.handle(FileCityTrailEvent.FILE_PATH, (_event, id: string) =>
    store.getFilePath(id),
  );
  // ACTIVATE is now a "show this trail in the calling window" op — it
  // resolves the payload + repo for the caller to update local state and
  // emit an in-window renderer event. No persisted active pointer is
  // touched; cross-window notification still goes via the HTTP /activate
  // route, which broadcasts PAYLOAD_SET.
  ipcMain.handle(FileCityTrailEvent.ACTIVATE, (_event, id: string) =>
    store.loadByIdWithRepoPath(id),
  );
  ipcMain.handle(FileCityTrailEvent.DELETE, (_event, id: string) =>
    store.delete(id),
  );
  ipcMain.handle(
    FileCityTrailEvent.NOTE_CREATE,
    async (_event, payloadId: string, draft: TrailNoteDraft) => {
      const note = await store.createNote(payloadId, draft);
      void broadcastLibraryChangedForTrail(store, payloadId);
      return note;
    },
  );
  ipcMain.handle(
    FileCityTrailEvent.NOTE_UPDATE,
    async (_event, payloadId: string, noteId: string, body: string) => {
      const note = await store.updateNote(payloadId, noteId, body);
      void broadcastLibraryChangedForTrail(store, payloadId);
      return note;
    },
  );
  ipcMain.handle(
    FileCityTrailEvent.NOTE_DELETE,
    async (_event, payloadId: string, noteId: string) => {
      await store.deleteNote(payloadId, noteId);
      void broadcastLibraryChangedForTrail(store, payloadId);
    },
  );
  ipcMain.handle(
    FileCityTrailEvent.SHARE,
    (_event, id: string, options: TrailShareOptions | null) =>
      shareEnvelope(() => store.share(id, options ?? undefined)),
  );
  ipcMain.handle(
    FileCityTrailEvent.LIST_SHARED,
    (_event, options: TrailListSharedOptions | null) =>
      shareEnvelope(() => store.listShared(options ?? undefined)),
  );
  ipcMain.handle(
    FileCityTrailEvent.FETCH_SHARED,
    (_event, owner: string, repo: string, id: string) =>
      shareEnvelope(() => store.fetchShared(owner, repo, id)),
  );
  ipcMain.handle(
    FileCityTrailEvent.FETCH_SHARED_BY_ID,
    (_event, id: string) =>
      shareEnvelope(() => store.fetchSharedById(id)),
  );
  ipcMain.handle(
    FileCityTrailEvent.SHARED_NOTE_CREATE,
    (_event, id: string, draft: TrailNoteDraft) =>
      shareEnvelope(() => store.createSharedNote(id, draft)),
  );
  ipcMain.handle(
    FileCityTrailEvent.SET_TRANSIENT,
    (_event, payload: TrailPayload, repositoryPath: string | undefined) => {
      store.setTransient(payload, repositoryPath);
    },
  );
}
