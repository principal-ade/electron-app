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
  fetchSharedTrail,
  fetchSharedTrailById,
  listSharedTrails,
  shareTrail,
} from './trailShare';
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
      edited = { ...existing, body, updatedAt: new Date().toISOString() };
      return {
        ...p,
        notes: (p.notes ?? []).map((n) => (n.id === noteId ? edited! : n)),
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

  listShared(
    options?: TrailListSharedOptions,
  ): Promise<TrailListSharedResult> {
    return listSharedTrails(options);
  }

  fetchShared(
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCityTrailFetchSharedResult> {
    return fetchSharedTrail(owner, repo, id);
  }

  fetchSharedById(id: string): Promise<FileCityTrailFetchSharedByIdResult> {
    return fetchSharedTrailById(id);
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
 * Push an IPC event to renderer windows hosting a specific topic.
 * Workspace windows stamp `metadata.topicIds` at open time from the
 * backing `Workspace.topicIds`; this helper fans out to any window whose
 * metadata lists `topicId`. Returns the number of windows the event was
 * delivered to. Sends nothing (and returns 0) for an undefined topicId.
 */
export function sendToTopicWindows(
  eventName: FileCityTrailEvent,
  payload: unknown,
  topicId: string | undefined,
): number {
  if (!topicId) return 0;
  let delivered = 0;
  for (const appWindow of applicationWindows.values()) {
    if (!appWindow.metadata?.topicIds?.includes(topicId)) continue;
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
    (_event, payloadId: string, draft: TrailNoteDraft) =>
      store.createNote(payloadId, draft),
  );
  ipcMain.handle(
    FileCityTrailEvent.NOTE_UPDATE,
    (_event, payloadId: string, noteId: string, body: string) =>
      store.updateNote(payloadId, noteId, body),
  );
  ipcMain.handle(
    FileCityTrailEvent.NOTE_DELETE,
    async (_event, payloadId: string, noteId: string) => {
      await store.deleteNote(payloadId, noteId);
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
    FileCityTrailEvent.SET_TRANSIENT,
    (_event, payload: TrailPayload, repositoryPath: string | undefined) => {
      store.setTransient(payload, repositoryPath);
    },
  );
}
