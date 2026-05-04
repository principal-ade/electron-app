/**
 * Disk-backed store for File City sequence-diagram payloads, plus the IPC
 * surface that backs the `mainProcess.fileCitySequence` API in the renderer
 * and the broadcast helpers fired by the HTTP routes.
 *
 * Payloads live on disk via `SequenceDiagramPersistence`; this module owns
 * the IPC + broadcast layer on top.
 */

import { BrowserWindow, ipcMain } from 'electron';
import * as crypto from 'crypto';
import {
  FileCitySequenceEvent,
  SequenceDiagramShareError,
  type FileCitySequenceFetchSharedResult,
  type FileCitySequenceShareResult,
  type SequenceDiagramIndexEntry,
  type SequenceDiagramListSharedOptions,
  type SequenceDiagramListSharedResult,
  type SequenceDiagramPayload,
  type SequenceDiagramShareEnvelope,
  type SequenceDiagramShareOptions,
  type SequenceNote,
  type SequenceNoteDraft,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { SequenceDiagramPersistence } from './sequenceDiagramPersistence';
import {
  fetchSharedSequenceDiagram,
  listSharedSequenceDiagrams,
  shareSequenceDiagram,
} from './sequenceDiagramShare';

export interface SetOptions {
  /** Whether to broadcast PAYLOAD_SET and mark the entry active. Default true. */
  activate?: boolean;
}

export interface SetResult {
  payload: SequenceDiagramPayload;
  broadcastTo: number;
  evictedIds: string[];
}

export class SequenceDiagramStore {
  private persistence = new SequenceDiagramPersistence();

  async set(
    incoming: SequenceDiagramPayload,
    options: SetOptions = {},
  ): Promise<SetResult> {
    const activate = options.activate !== false;
    const { payload, evictedIds } = await this.persistence.save(incoming, {
      activate,
    });
    let broadcastTo = 0;
    if (activate) {
      broadcastTo = broadcast(FileCitySequenceEvent.PAYLOAD_SET, payload);
    }
    broadcast(FileCitySequenceEvent.LIBRARY_CHANGED, {
      repositoryPath: payload.repositoryPath,
    });
    return { payload, broadcastTo, evictedIds };
  }

  async clear(repositoryPath?: string): Promise<number> {
    await this.persistence.deactivate(repositoryPath);
    const broadcastTo = broadcast(FileCitySequenceEvent.PAYLOAD_CLEARED, {
      repositoryPath,
    });
    broadcast(FileCitySequenceEvent.LIBRARY_CHANGED, { repositoryPath });
    return broadcastTo;
  }

  async activate(id: string): Promise<{
    payload: SequenceDiagramPayload | null;
    broadcastTo: number;
  }> {
    const payload = await this.persistence.setActive(id);
    if (!payload) return { payload: null, broadcastTo: 0 };
    const broadcastTo = broadcast(
      FileCitySequenceEvent.PAYLOAD_SET,
      payload,
    );
    broadcast(FileCitySequenceEvent.LIBRARY_CHANGED, {
      repositoryPath: payload.repositoryPath,
    });
    return { payload, broadcastTo };
  }

  async delete(id: string): Promise<{ found: boolean }> {
    const result = await this.persistence.deleteById(id);
    if (!result) return { found: false };
    if (result.wasActive) {
      broadcast(FileCitySequenceEvent.PAYLOAD_CLEARED, {
        repositoryPath: result.repositoryPath,
      });
    }
    broadcast(FileCitySequenceEvent.LIBRARY_CHANGED, {
      repositoryPath: result.repositoryPath,
    });
    return { found: true };
  }

  get(repositoryPath?: string): Promise<SequenceDiagramPayload | null> {
    return this.persistence.getActive(repositoryPath);
  }

  getAll(): Promise<SequenceDiagramPayload[]> {
    return this.persistence.getActiveAll();
  }

  loadById(id: string): Promise<SequenceDiagramPayload | null> {
    return this.persistence.loadById(id);
  }

  list(repositoryPath?: string): Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }> {
    return this.persistence.listEntries(repositoryPath);
  }

  async createNote(
    payloadId: string,
    draft: SequenceNoteDraft,
  ): Promise<SequenceNote> {
    const now = new Date().toISOString();
    const note: SequenceNote = {
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
      throw new Error(`payload ${payloadId} not found`);
    }
    broadcast(FileCitySequenceEvent.PAYLOAD_SET, updated);
    return note;
  }

  async updateNote(
    payloadId: string,
    noteId: string,
    body: string,
  ): Promise<SequenceNote> {
    let edited: SequenceNote | null = null;
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
      throw new Error(`note ${noteId} not found on payload ${payloadId}`);
    }
    broadcast(FileCitySequenceEvent.PAYLOAD_SET, updated);
    return edited;
  }

  async deleteNote(payloadId: string, noteId: string): Promise<void> {
    const updated = await this.persistence.applyToPayload(payloadId, (p) => ({
      ...p,
      notes: (p.notes ?? []).filter((n) => n.id !== noteId),
    }));
    if (!updated) {
      throw new Error(`payload ${payloadId} not found`);
    }
    broadcast(FileCitySequenceEvent.PAYLOAD_SET, updated);
  }

  share(
    id: string,
    options?: SequenceDiagramShareOptions,
  ): Promise<FileCitySequenceShareResult> {
    return shareSequenceDiagram(
      { loadPayload: (payloadId) => this.persistence.loadById(payloadId) },
      id,
      options,
    );
  }

  listShared(
    options?: SequenceDiagramListSharedOptions,
  ): Promise<SequenceDiagramListSharedResult> {
    return listSharedSequenceDiagrams(options);
  }

  fetchShared(
    owner: string,
    repo: string,
    id: string,
  ): Promise<FileCitySequenceFetchSharedResult> {
    return fetchSharedSequenceDiagram(owner, repo, id);
  }

  setTransient(payload: SequenceDiagramPayload): { broadcastTo: number } {
    const broadcastTo = broadcast(FileCitySequenceEvent.PAYLOAD_SET, payload);
    return { broadcastTo };
  }
}

/**
 * Wrap a thrown SequenceDiagramShareError into the IPC envelope so the typed
 * code survives structured-clone serialization across the preload boundary.
 * Anything else gets the generic WEB_ADE_ERROR bucket so the renderer always
 * has a code to switch on.
 */
async function shareEnvelope<T>(
  fn: () => Promise<T>,
): Promise<SequenceDiagramShareEnvelope<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    if (err instanceof SequenceDiagramShareError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details,
      };
    }
    console.error('[SequenceDiagramStore] share IPC failed', err);
    return {
      ok: false,
      code: 'WEB_ADE_ERROR',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function broadcast(eventName: FileCitySequenceEvent, payload: unknown): number {
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

let singleton: SequenceDiagramStore | null = null;

export function getSequenceDiagramStore(): SequenceDiagramStore {
  if (!singleton) {
    singleton = new SequenceDiagramStore();
  }
  return singleton;
}

export function registerSequenceDiagramHandlers(): void {
  const store = getSequenceDiagramStore();
  ipcMain.handle(
    FileCitySequenceEvent.GET_CURRENT,
    (_event, repositoryPath?: string) => store.get(repositoryPath),
  );
  ipcMain.handle(
    FileCitySequenceEvent.LIST,
    (_event, repositoryPath?: string) => store.list(repositoryPath),
  );
  ipcMain.handle(FileCitySequenceEvent.LOAD, (_event, id: string) =>
    store.loadById(id),
  );
  ipcMain.handle(FileCitySequenceEvent.ACTIVATE, async (_event, id: string) => {
    await store.activate(id);
  });
  ipcMain.handle(FileCitySequenceEvent.DELETE, async (_event, id: string) => {
    await store.delete(id);
  });
  ipcMain.handle(
    FileCitySequenceEvent.NOTE_CREATE,
    (_event, payloadId: string, draft: SequenceNoteDraft) =>
      store.createNote(payloadId, draft),
  );
  ipcMain.handle(
    FileCitySequenceEvent.NOTE_UPDATE,
    (_event, payloadId: string, noteId: string, body: string) =>
      store.updateNote(payloadId, noteId, body),
  );
  ipcMain.handle(
    FileCitySequenceEvent.NOTE_DELETE,
    async (_event, payloadId: string, noteId: string) => {
      await store.deleteNote(payloadId, noteId);
    },
  );
  ipcMain.handle(
    FileCitySequenceEvent.SHARE,
    (_event, id: string, options: SequenceDiagramShareOptions | null) =>
      shareEnvelope(() => store.share(id, options ?? undefined)),
  );
  ipcMain.handle(
    FileCitySequenceEvent.LIST_SHARED,
    (_event, options: SequenceDiagramListSharedOptions | null) =>
      shareEnvelope(() => store.listShared(options ?? undefined)),
  );
  ipcMain.handle(
    FileCitySequenceEvent.FETCH_SHARED,
    (_event, owner: string, repo: string, id: string) =>
      shareEnvelope(() => store.fetchShared(owner, repo, id)),
  );
  ipcMain.handle(
    FileCitySequenceEvent.SET_TRANSIENT,
    (_event, payload: SequenceDiagramPayload) => {
      store.setTransient(payload);
    },
  );
}
