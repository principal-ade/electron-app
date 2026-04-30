/**
 * In-memory store for the latest sequence-diagram payload(s) pushed via
 * the HTTP bridge, plus the broadcast helper that fans them out to all
 * renderer windows.
 *
 * Payloads are keyed by `repositoryPath` so a multi-window setup can
 * target a specific File City panel. Payloads without a repo path fall
 * into a single `__default__` slot.
 */

import { BrowserWindow, ipcMain } from 'electron';
import {
  FileCitySequenceEvent,
  type SequenceDiagramPayload,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const DEFAULT_KEY = '__default__';

const keyFor = (payload: Pick<SequenceDiagramPayload, 'repositoryPath'>): string =>
  payload.repositoryPath ?? DEFAULT_KEY;

export class SequenceDiagramStore {
  private payloads = new Map<string, SequenceDiagramPayload>();

  set(payload: SequenceDiagramPayload): number {
    this.payloads.set(keyFor(payload), payload);
    return broadcast(FileCitySequenceEvent.PAYLOAD_SET, payload);
  }

  clear(repositoryPath?: string): number {
    const key = repositoryPath ?? DEFAULT_KEY;
    this.payloads.delete(key);
    return broadcast(FileCitySequenceEvent.PAYLOAD_CLEARED, { repositoryPath });
  }

  get(repositoryPath?: string): SequenceDiagramPayload | null {
    return this.payloads.get(repositoryPath ?? DEFAULT_KEY) ?? null;
  }

  getAll(): SequenceDiagramPayload[] {
    return Array.from(this.payloads.values());
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
}
