/**
 * Disk persistence for File City sequence-diagram payloads.
 *
 * Layout under `app.getPath('userData')`:
 *
 *   file-city-sequence-diagrams/
 *     index.json                 manifest (entries[] + active{})
 *     repo-agnostic/<id>.json    payloads with no repositoryPath
 *     <projectHash>/<id>.json    payloads keyed by md5(repositoryPath)
 *
 * The manifest is rebuilt from disk if missing or unparseable.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type {
  SequenceDiagramPayload,
  SequenceDiagramIndexEntry,
} from '../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const REPO_AGNOSTIC_DIR = 'repo-agnostic';
const INDEX_FILENAME = 'index.json';
const SUMMARY_PREVIEW_MAX = 200;
const PER_REPO_CAP = 50;

/**
 * Migrate legacy single-line slice anchors (`{ lineNumber, lineText }`) to the
 * current ranges-array shape. Idempotent — payloads already in the new shape
 * pass through untouched. Run on every load so existing on-disk notes keep
 * working without a one-shot migration script.
 */
function migrateNoteAnchors(
  payload: SequenceDiagramPayload,
): SequenceDiagramPayload {
  if (!payload.notes || payload.notes.length === 0) return payload;
  let touched = false;
  const migrated = payload.notes.map((note) => {
    if (note.kind !== 'snippet') return note;
    const anchor = note.anchor as
      | { kind: 'slice'; ranges?: unknown; lineNumber?: number; lineText?: string }
      | { kind: 'diff' };
    if (anchor.kind !== 'slice') return note;
    if (Array.isArray(anchor.ranges)) return note;
    const lineNumber =
      typeof anchor.lineNumber === 'number' ? anchor.lineNumber : 1;
    const lineText = typeof anchor.lineText === 'string' ? anchor.lineText : '';
    touched = true;
    return {
      ...note,
      anchor: {
        kind: 'slice' as const,
        ranges: [
          {
            startLine: lineNumber,
            endLine: lineNumber,
            startLineText: lineText,
            endLineText: lineText,
          },
        ],
      },
    };
  });
  return touched ? { ...payload, notes: migrated } : payload;
}

export const ACTIVE_DEFAULT_KEY = '__default__';

interface IndexFileV1 {
  version: 1;
  entries: SequenceDiagramIndexEntry[];
  active: Record<string, string | null>;
}

const emptyIndex = (): IndexFileV1 => ({
  version: 1,
  entries: [],
  active: {},
});

const projectHash = (repositoryPath: string): string => {
  const normalized = path.resolve(repositoryPath);
  return crypto.createHash('md5').update(normalized).digest('hex');
};

const subdirFor = (repositoryPath?: string): string =>
  repositoryPath ? projectHash(repositoryPath) : REPO_AGNOSTIC_DIR;

const activeKey = (repositoryPath?: string): string =>
  repositoryPath ?? ACTIVE_DEFAULT_KEY;

const summaryPreview = (summary?: string): string | undefined => {
  if (!summary) return undefined;
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, SUMMARY_PREVIEW_MAX - 1)}…`;
};

const hasDiffSnippets = (payload: SequenceDiagramPayload): boolean =>
  payload.events.some((ev) => ev.snippet?.kind === 'diff');

const buildEntry = (
  payload: SequenceDiagramPayload & {
    id: string;
    createdAt: string;
    updatedAt: string;
  },
  sizeBytes: number,
): SequenceDiagramIndexEntry => ({
  id: payload.id,
  repositoryPath: payload.repositoryPath,
  title: payload.title,
  summaryPreview: summaryPreview(payload.summary),
  eventCount: payload.events.length,
  hasDiffSnippets: hasDiffSnippets(payload),
  createdAt: payload.createdAt,
  updatedAt: payload.updatedAt,
  sizeBytes,
});

export class SequenceDiagramPersistence {
  private readonly baseDir: string;
  private readonly indexPath: string;
  private index: IndexFileV1 | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.baseDir = path.join(
      app.getPath('userData'),
      'file-city-sequence-diagrams',
    );
    this.indexPath = path.join(this.baseDir, INDEX_FILENAME);
  }

  private async getIndex(): Promise<IndexFileV1> {
    if (!this.index) {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.index = await this.loadIndex();
    }
    return this.index;
  }

  async listEntries(repositoryPath?: string): Promise<{
    entries: SequenceDiagramIndexEntry[];
    activeId: string | null;
  }> {
    const idx = await this.getIndex();
    const entries = repositoryPath
      ? idx.entries.filter(
          (e) =>
            e.repositoryPath === repositoryPath || e.repositoryPath == null,
        )
      : idx.entries.slice();
    entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const activeId = idx.active[activeKey(repositoryPath)] ?? null;
    return { entries, activeId };
  }

  async getActive(
    repositoryPath?: string,
  ): Promise<SequenceDiagramPayload | null> {
    const idx = await this.getIndex();
    const id = idx.active[activeKey(repositoryPath)];
    if (!id) return null;
    return this.loadById(id);
  }

  async getActiveAll(): Promise<SequenceDiagramPayload[]> {
    const idx = await this.getIndex();
    const ids = Object.values(idx.active).filter(
      (v): v is string => typeof v === 'string',
    );
    const payloads = await Promise.all(ids.map((id) => this.loadById(id)));
    return payloads.filter((p): p is SequenceDiagramPayload => p != null);
  }

  async loadById(id: string): Promise<SequenceDiagramPayload | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    const file = path.join(
      this.baseDir,
      subdirFor(entry.repositoryPath),
      `${id}.json`,
    );
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as SequenceDiagramPayload;
      return migrateNoteAnchors(parsed);
    } catch (err) {
      console.error(
        '[SequenceDiagramPersistence] Failed to load payload',
        id,
        err,
      );
      return null;
    }
  }

  /**
   * Persist a payload. Assigns id + timestamps when missing. When `activate`
   * is true, marks the payload as active for its repository in the manifest.
   * Returns the persisted payload (with assigned fields).
   */
  async save(
    incoming: SequenceDiagramPayload,
    options: { activate: boolean },
  ): Promise<{
    payload: SequenceDiagramPayload;
    evictedIds: string[];
  }> {
    const idx = await this.getIndex();
    const now = new Date().toISOString();
    const id = incoming.id?.trim() || crypto.randomUUID();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    const existing = existingIdx >= 0 ? idx.entries[existingIdx] : null;

    // Lift notes from the existing payload on disk so external re-pushes
    // (which never carry `notes` — validation strips them) don't wipe
    // user-authored notes. Renderer-driven note mutations go through
    // `applyToPayload`, which writes notes onto the same on-disk record.
    let preservedNotes = incoming.notes;
    if (preservedNotes === undefined && existing) {
      const onDisk = await this.loadById(id);
      preservedNotes = onDisk?.notes;
    }

    const payload: SequenceDiagramPayload & {
      id: string;
      createdAt: string;
      updatedAt: string;
    } = {
      ...incoming,
      notes: preservedNotes,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const subdir = subdirFor(payload.repositoryPath);
    await fs.mkdir(path.join(this.baseDir, subdir), { recursive: true });
    const file = path.join(this.baseDir, subdir, `${id}.json`);
    const serialized = JSON.stringify(payload, null, 2);
    await fs.writeFile(file, serialized, 'utf8');

    const entry = buildEntry(payload, Buffer.byteLength(serialized, 'utf8'));
    if (existingIdx >= 0) {
      idx.entries[existingIdx] = entry;
    } else {
      idx.entries.push(entry);
    }

    const evictedIds = await this.enforceCap(idx, payload.repositoryPath);

    if (options.activate) {
      idx.active[activeKey(payload.repositoryPath)] = id;
    }

    await this.persistIndex();
    return { payload, evictedIds };
  }

  /**
   * Load a payload by id, run a mutator, write the result back, and refresh
   * the index entry. Does not change active state. Used by note CRUD so the
   * renderer can mutate `payload.notes` without going through `save` (which
   * carries different semantics around timestamps + activation).
   */
  async applyToPayload(
    id: string,
    mutator: (
      payload: SequenceDiagramPayload & {
        id: string;
        createdAt: string;
        updatedAt: string;
      },
    ) => SequenceDiagramPayload,
  ): Promise<SequenceDiagramPayload | null> {
    const idx = await this.getIndex();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    if (existingIdx < 0) return null;
    const existing = idx.entries[existingIdx];
    const onDisk = await this.loadById(id);
    if (!onDisk) return null;
    const now = new Date().toISOString();
    const stamped = {
      ...onDisk,
      id,
      createdAt: onDisk.createdAt ?? existing.createdAt,
      updatedAt: onDisk.updatedAt ?? existing.updatedAt,
    } as SequenceDiagramPayload & {
      id: string;
      createdAt: string;
      updatedAt: string;
    };
    const mutated = mutator(stamped);
    const next: SequenceDiagramPayload & {
      id: string;
      createdAt: string;
      updatedAt: string;
    } = {
      ...mutated,
      id,
      createdAt: stamped.createdAt,
      updatedAt: now,
    };
    const subdir = subdirFor(next.repositoryPath);
    await fs.mkdir(path.join(this.baseDir, subdir), { recursive: true });
    const file = path.join(this.baseDir, subdir, `${id}.json`);
    const serialized = JSON.stringify(next, null, 2);
    await fs.writeFile(file, serialized, 'utf8');
    idx.entries[existingIdx] = buildEntry(
      next,
      Buffer.byteLength(serialized, 'utf8'),
    );
    await this.persistIndex();
    return next;
  }

  async setActive(id: string): Promise<SequenceDiagramPayload | null> {
    const idx = await this.getIndex();
    const payload = await this.loadById(id);
    if (!payload) return null;
    idx.active[activeKey(payload.repositoryPath)] = id;
    await this.persistIndex();
    return payload;
  }

  /**
   * Clear the active slot for a repository. Does not delete saved entries.
   */
  async deactivate(repositoryPath?: string): Promise<void> {
    const idx = await this.getIndex();
    idx.active[activeKey(repositoryPath)] = null;
    await this.persistIndex();
  }

  /**
   * Delete an entry from disk + manifest. Returns metadata about the deleted
   * entry plus whether it was the active entry for its repo, so the caller
   * can broadcast PAYLOAD_CLEARED.
   */
  async deleteById(
    id: string,
  ): Promise<{
    repositoryPath?: string;
    wasActive: boolean;
  } | null> {
    const idx = await this.getIndex();
    const entryIdx = idx.entries.findIndex((e) => e.id === id);
    if (entryIdx < 0) return null;
    const entry = idx.entries[entryIdx];
    idx.entries.splice(entryIdx, 1);

    const file = path.join(
      this.baseDir,
      subdirFor(entry.repositoryPath),
      `${id}.json`,
    );
    try {
      await fs.unlink(file);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.error(
          '[SequenceDiagramPersistence] Failed to unlink payload',
          id,
          err,
        );
      }
    }

    const key = activeKey(entry.repositoryPath);
    const wasActive = idx.active[key] === id;
    if (wasActive) {
      idx.active[key] = null;
    }
    await this.persistIndex();
    return { repositoryPath: entry.repositoryPath, wasActive };
  }

  private async enforceCap(
    idx: IndexFileV1,
    repositoryPath?: string,
  ): Promise<string[]> {
    const matching = idx.entries
      .filter((e) => e.repositoryPath === repositoryPath)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (matching.length <= PER_REPO_CAP) return [];
    const toEvict = matching.slice(PER_REPO_CAP);
    const evictedIds: string[] = [];
    for (const entry of toEvict) {
      const file = path.join(
        this.baseDir,
        subdirFor(entry.repositoryPath),
        `${entry.id}.json`,
      );
      try {
        await fs.unlink(file);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          console.error(
            '[SequenceDiagramPersistence] Failed to evict',
            entry.id,
            err,
          );
        }
      }
      evictedIds.push(entry.id);
      const key = activeKey(entry.repositoryPath);
      if (idx.active[key] === entry.id) {
        idx.active[key] = null;
      }
    }
    idx.entries = idx.entries.filter((e) => !evictedIds.includes(e.id));
    if (evictedIds.length > 0) {
      console.warn(
        `[SequenceDiagramPersistence] Evicted ${evictedIds.length} entries for repo cap (${PER_REPO_CAP})`,
      );
    }
    return evictedIds;
  }

  private async loadIndex(): Promise<IndexFileV1> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<IndexFileV1>;
      if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
        return {
          version: 1,
          entries: parsed.entries,
          active: parsed.active ?? {},
        };
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.warn(
          '[SequenceDiagramPersistence] index.json unreadable, rebuilding',
          err,
        );
      }
    }
    return this.rebuildIndex();
  }

  private async rebuildIndex(): Promise<IndexFileV1> {
    const idx = emptyIndex();
    let subdirs: string[];
    try {
      subdirs = await fs.readdir(this.baseDir);
    } catch {
      return idx;
    }
    for (const subdir of subdirs) {
      const subdirPath = path.join(this.baseDir, subdir);
      let stat;
      try {
        stat = await fs.stat(subdirPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      let files: string[];
      try {
        files = await fs.readdir(subdirPath);
      } catch {
        continue;
      }
      for (const filename of files) {
        if (!filename.endsWith('.json')) continue;
        const file = path.join(subdirPath, filename);
        try {
          const raw = await fs.readFile(file, 'utf8');
          const parsed = JSON.parse(raw) as SequenceDiagramPayload;
          const fallbackId = filename.replace(/\.json$/, '');
          const createdAt = parsed.createdAt ?? new Date().toISOString();
          const stamped: SequenceDiagramPayload & {
            id: string;
            createdAt: string;
            updatedAt: string;
          } = {
            ...parsed,
            id: parsed.id || fallbackId,
            createdAt,
            updatedAt: parsed.updatedAt ?? createdAt,
          };
          idx.entries.push(
            buildEntry(stamped, Buffer.byteLength(raw, 'utf8')),
          );
        } catch (err) {
          console.warn(
            '[SequenceDiagramPersistence] Skipping unparseable file',
            file,
            err,
          );
        }
      }
    }
    return idx;
  }

  private persistIndex(): Promise<void> {
    if (!this.index) return Promise.resolve();
    const snapshot = this.index;
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        const raw = JSON.stringify(snapshot, null, 2);
        await fs.writeFile(this.indexPath, raw, 'utf8');
      });
    return this.writeQueue;
  }
}
