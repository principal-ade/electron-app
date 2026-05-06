/**
 * Disk-backed store for File City trail payloads, plus the IPC surface
 * that backs the `mainProcess.fileCityTrail` API in the renderer and the
 * broadcast helpers fired by the HTTP routes.
 *
 * Parallel implementation to `sequenceDiagramStore.ts`.
 */

import { BrowserWindow, ipcMain } from 'electron';
import * as crypto from 'crypto';
import {
  FileCityTrailEvent,
  TrailShareError,
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
  listSharedTrails,
  shareTrail,
} from './trailShare';

export interface SetOptions {
  /** Whether to broadcast PAYLOAD_SET and mark the entry active. Default true. */
  activate?: boolean;
  /**
   * Host-private filesystem path the trail belongs to. Persisted on the
   * index entry only; never written into the portable trail payload.
   */
  repositoryPath?: string;
}

export interface SetResult {
  payload: TrailPayload;
  broadcastTo: number;
  evictedIds: string[];
}

export class TrailStore {
  private persistence = new TrailPersistence();

  async set(
    incoming: TrailPayload,
    options: SetOptions = {},
  ): Promise<SetResult> {
    const activate = options.activate !== false;
    const { payload, evictedIds } = await this.persistence.save(incoming, {
      activate,
      repositoryPath: options.repositoryPath,
    });
    let broadcastTo = 0;
    if (activate) {
      broadcastTo = broadcast(FileCityTrailEvent.PAYLOAD_SET, {
        payload,
        repositoryPath: options.repositoryPath,
      });
    }
    broadcast(FileCityTrailEvent.LIBRARY_CHANGED, {
      repositoryPath: options.repositoryPath,
    });
    return { payload, broadcastTo, evictedIds };
  }

  async clear(repositoryPath?: string): Promise<number> {
    await this.persistence.deactivate(repositoryPath);
    const broadcastTo = broadcast(FileCityTrailEvent.PAYLOAD_CLEARED, {
      repositoryPath,
    });
    broadcast(FileCityTrailEvent.LIBRARY_CHANGED, { repositoryPath });
    return broadcastTo;
  }

  async activate(id: string): Promise<{
    payload: TrailPayload | null;
    broadcastTo: number;
  }> {
    const payload = await this.persistence.setActive(id);
    if (!payload) return { payload: null, broadcastTo: 0 };
    const entry = await this.persistence.loadEntryById(id);
    const broadcastTo = broadcast(FileCityTrailEvent.PAYLOAD_SET, {
      payload,
      repositoryPath: entry?.repositoryPath,
    });
    broadcast(FileCityTrailEvent.LIBRARY_CHANGED, {
      repositoryPath: entry?.repositoryPath,
    });
    return { payload, broadcastTo };
  }

  async delete(id: string): Promise<{ found: boolean }> {
    const result = await this.persistence.deleteById(id);
    if (!result) return { found: false };
    if (result.wasActive) {
      broadcast(FileCityTrailEvent.PAYLOAD_CLEARED, {
        repositoryPath: result.repositoryPath,
      });
    }
    broadcast(FileCityTrailEvent.LIBRARY_CHANGED, {
      repositoryPath: result.repositoryPath,
    });
    return { found: true };
  }

  get(repositoryPath?: string): Promise<TrailPayload | null> {
    return this.persistence.getActive(repositoryPath);
  }

  getAll(): Promise<TrailPayload[]> {
    return this.persistence.getActiveAll();
  }

  loadById(id: string): Promise<TrailPayload | null> {
    return this.persistence.loadById(id);
  }

  list(repositoryPath?: string): Promise<{
    entries: TrailIndexEntry[];
    activeId: string | null;
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
    const entry = await this.persistence.loadEntryById(payloadId);
    broadcast(FileCityTrailEvent.PAYLOAD_SET, {
      payload: updated,
      repositoryPath: entry?.repositoryPath,
    });
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
    const entry = await this.persistence.loadEntryById(payloadId);
    broadcast(FileCityTrailEvent.PAYLOAD_SET, {
      payload: updated,
      repositoryPath: entry?.repositoryPath,
    });
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
    const entry = await this.persistence.loadEntryById(payloadId);
    broadcast(FileCityTrailEvent.PAYLOAD_SET, {
      payload: updated,
      repositoryPath: entry?.repositoryPath,
    });
  }

  share(
    id: string,
    options?: TrailShareOptions,
  ): Promise<FileCityTrailShareResult> {
    return shareTrail(
      {
        loadPayload: (payloadId) => this.persistence.loadById(payloadId),
        loadEntry: (payloadId) => this.persistence.loadEntryById(payloadId),
      },
      id,
      options,
    );
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

  setTransient(payload: TrailPayload): { broadcastTo: number } {
    const broadcastTo = broadcast(FileCityTrailEvent.PAYLOAD_SET, {
      payload,
    });
    return { broadcastTo };
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

function broadcast(eventName: FileCityTrailEvent, payload: unknown): number {
  const windows = BrowserWindow.getAllWindows();
  let delivered = 0;
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(eventName, payload);
      delivered += 1;
    }
  }
  return delivered;
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
    FileCityTrailEvent.GET_CURRENT,
    (_event, repositoryPath?: string) => store.get(repositoryPath),
  );
  ipcMain.handle(
    FileCityTrailEvent.LIST,
    (_event, repositoryPath?: string) => store.list(repositoryPath),
  );
  ipcMain.handle(FileCityTrailEvent.LOAD, (_event, id: string) =>
    store.loadById(id),
  );
  ipcMain.handle(FileCityTrailEvent.ACTIVATE, async (_event, id: string) => {
    await store.activate(id);
  });
  ipcMain.handle(FileCityTrailEvent.DELETE, async (_event, id: string) => {
    await store.delete(id);
  });
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
    FileCityTrailEvent.SET_TRANSIENT,
    (_event, payload: TrailPayload) => {
      store.setTransient(payload);
    },
  );
}
