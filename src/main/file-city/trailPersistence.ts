/**
 * Disk persistence for File City trail payloads.
 *
 * Layout under `app.getPath('userData')`:
 *
 *   file-city-trails/
 *     index.json                 manifest (entries[] + active{})
 *     repo-agnostic/<id>.json    payloads with no repositoryPath
 *     <projectHash>/<id>.json    payloads keyed by md5(repositoryPath)
 *
 * Parallel to `sequenceDiagramPersistence.ts`. Trail payloads are
 * deliberately portable — they never carry filesystem paths. The host
 * keeps `repositoryPath` on the index entry only, separate from the
 * payload itself.
 *
 * The manifest is rebuilt from disk if missing or unparseable.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type {
  TrailPayload,
} from '@industry-theme/file-city-panel';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

const REPO_AGNOSTIC_DIR = 'repo-agnostic';
const INDEX_FILENAME = 'index.json';
const SUMMARY_PREVIEW_MAX = 200;
const PER_REPO_CAP = 50;

export const ACTIVE_DEFAULT_KEY = '__default__';

interface IndexFileV1 {
  version: 1;
  entries: TrailIndexEntry[];
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

const summaryPreview = (summary?: string): string => {
  if (!summary) return '';
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, SUMMARY_PREVIEW_MAX - 1)}…`;
};

const hasDiffSnippets = (payload: TrailPayload): boolean =>
  payload.markers.some((m) => m.snippet?.kind === 'diff');

const repoNamesOf = (payload: TrailPayload): string[] => {
  const names = (payload.repos ?? []).map((r) => r.name).filter(Boolean);
  return names;
};

const buildEntry = (
  payload: TrailPayload,
  repositoryPath: string | undefined,
  sizeBytes: number,
): TrailIndexEntry => ({
  id: payload.id,
  title: payload.title || 'Untitled trail',
  summaryPreview: summaryPreview(payload.summary),
  markerCount: payload.markers.length,
  repoNames: repoNamesOf(payload),
  hasDiffSnippets: hasDiffSnippets(payload),
  createdAt: payload.createdAt,
  updatedAt: payload.updatedAt,
  sizeBytes,
  repositoryPath,
});

/**
 * Persistence record passed across the public API. The on-disk file stores
 * the portable `payload` plus a host-private `repositoryPath` sidecar so
 * the persistence layer can bucket payloads by repo without polluting the
 * portable schema.
 */
interface OnDiskRecord {
  /** The portable trail payload — written to disk and shipped to renderers. */
  payload: TrailPayload;
  /** Host-private path for repo bucketing. Not part of the trail schema. */
  repositoryPath?: string;
}

export class TrailPersistence {
  private readonly baseDir: string;
  private readonly indexPath: string;
  private index: IndexFileV1 | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), 'file-city-trails');
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
    entries: TrailIndexEntry[];
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

  async getActive(repositoryPath?: string): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const id = idx.active[activeKey(repositoryPath)];
    if (!id) return null;
    return this.loadById(id);
  }

  async getActiveAll(): Promise<TrailPayload[]> {
    const idx = await this.getIndex();
    const ids = Object.values(idx.active).filter(
      (v): v is string => typeof v === 'string',
    );
    const payloads = await Promise.all(ids.map((id) => this.loadById(id)));
    return payloads.filter((p): p is TrailPayload => p != null);
  }

  async loadById(id: string): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    const record = await this.readRecord(id, entry.repositoryPath);
    return record?.payload ?? null;
  }

  async loadEntryById(id: string): Promise<TrailIndexEntry | null> {
    const idx = await this.getIndex();
    return idx.entries.find((e) => e.id === id) ?? null;
  }

  /**
   * Persist a payload. Assigns id + timestamps when missing. When `activate`
   * is true, marks the payload as active for its repository in the manifest.
   */
  async save(
    incoming: TrailPayload,
    options: { activate: boolean; repositoryPath?: string },
  ): Promise<{ payload: TrailPayload; evictedIds: string[] }> {
    const idx = await this.getIndex();
    const now = new Date().toISOString();
    const id = incoming.id?.trim() || crypto.randomUUID();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    const existing = existingIdx >= 0 ? idx.entries[existingIdx] : null;

    // Lift notes from the existing payload on disk so external re-pushes
    // (which never carry `notes` — validation strips them) don't wipe
    // user-authored notes. Renderer note mutations go through
    // `applyToPayload`, which writes notes back onto the same record.
    let preservedNotes = incoming.notes;
    if (preservedNotes === undefined && existing) {
      const onDisk = await this.readRecord(id, existing.repositoryPath);
      preservedNotes = onDisk?.payload.notes;
    }

    const payload: TrailPayload = {
      ...incoming,
      notes: preservedNotes,
      id,
      title: incoming.title || 'Untitled trail',
      createdAt: existing?.createdAt ?? incoming.createdAt ?? now,
      updatedAt: now,
    };

    const repositoryPath = options.repositoryPath ?? existing?.repositoryPath;
    const subdir = subdirFor(repositoryPath);
    await fs.mkdir(path.join(this.baseDir, subdir), { recursive: true });
    const file = path.join(this.baseDir, subdir, `${id}.json`);
    const record: OnDiskRecord = { payload, repositoryPath };
    const serialized = JSON.stringify(record, null, 2);
    await fs.writeFile(file, serialized, 'utf8');

    const entry = buildEntry(
      payload,
      repositoryPath,
      Buffer.byteLength(serialized, 'utf8'),
    );
    if (existingIdx >= 0) {
      idx.entries[existingIdx] = entry;
    } else {
      idx.entries.push(entry);
    }

    const evictedIds = await this.enforceCap(idx, repositoryPath);

    if (options.activate) {
      idx.active[activeKey(repositoryPath)] = id;
    }

    await this.persistIndex();
    return { payload, evictedIds };
  }

  /**
   * Load a payload, run a mutator, write the result back, refresh the index
   * entry. Does not change active state. Used by note CRUD.
   */
  async applyToPayload(
    id: string,
    mutator: (payload: TrailPayload) => TrailPayload,
  ): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    if (existingIdx < 0) return null;
    const existing = idx.entries[existingIdx];
    const onDisk = await this.readRecord(id, existing.repositoryPath);
    if (!onDisk) return null;
    const now = new Date().toISOString();
    const stamped: TrailPayload = {
      ...onDisk.payload,
      id,
      createdAt: onDisk.payload.createdAt ?? existing.createdAt,
      updatedAt: onDisk.payload.updatedAt ?? existing.updatedAt,
    };
    const mutated = mutator(stamped);
    const next: TrailPayload = {
      ...mutated,
      id,
      createdAt: stamped.createdAt,
      updatedAt: now,
    };
    const subdir = subdirFor(existing.repositoryPath);
    await fs.mkdir(path.join(this.baseDir, subdir), { recursive: true });
    const file = path.join(this.baseDir, subdir, `${id}.json`);
    const record: OnDiskRecord = {
      payload: next,
      repositoryPath: existing.repositoryPath,
    };
    const serialized = JSON.stringify(record, null, 2);
    await fs.writeFile(file, serialized, 'utf8');
    idx.entries[existingIdx] = buildEntry(
      next,
      existing.repositoryPath,
      Buffer.byteLength(serialized, 'utf8'),
    );
    await this.persistIndex();
    return next;
  }

  async setActive(id: string): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    const payload = await this.loadById(id);
    if (!payload) return null;
    idx.active[activeKey(entry.repositoryPath)] = id;
    await this.persistIndex();
    return payload;
  }

  async deactivate(repositoryPath?: string): Promise<void> {
    const idx = await this.getIndex();
    idx.active[activeKey(repositoryPath)] = null;
    await this.persistIndex();
  }

  async deleteById(
    id: string,
  ): Promise<{ repositoryPath?: string; wasActive: boolean } | null> {
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
        console.error('[TrailPersistence] Failed to unlink payload', id, err);
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

  private async readRecord(
    id: string,
    repositoryPath: string | undefined,
  ): Promise<OnDiskRecord | null> {
    const file = path.join(this.baseDir, subdirFor(repositoryPath), `${id}.json`);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw) as OnDiskRecord | TrailPayload;
      // Tolerate older records that stored the bare payload without the
      // wrapper. Detect by the presence of `markers` (TrailPayload) vs.
      // `payload` (OnDiskRecord).
      if ((parsed as OnDiskRecord).payload) {
        return parsed as OnDiskRecord;
      }
      return { payload: parsed as TrailPayload, repositoryPath };
    } catch (err) {
      console.error('[TrailPersistence] Failed to load payload', id, err);
      return null;
    }
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
          console.error('[TrailPersistence] Failed to evict', entry.id, err);
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
        `[TrailPersistence] Evicted ${evictedIds.length} entries for repo cap (${PER_REPO_CAP})`,
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
        console.warn('[TrailPersistence] index.json unreadable, rebuilding', err);
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
          const parsed = JSON.parse(raw) as OnDiskRecord | TrailPayload;
          const fallbackId = filename.replace(/\.json$/, '');
          const record: OnDiskRecord = (parsed as OnDiskRecord).payload
            ? (parsed as OnDiskRecord)
            : { payload: parsed as TrailPayload };
          const payload = record.payload;
          const createdAt = payload.createdAt ?? new Date().toISOString();
          const stamped: TrailPayload = {
            ...payload,
            id: payload.id || fallbackId,
            createdAt,
            updatedAt: payload.updatedAt ?? createdAt,
            title: payload.title || 'Untitled trail',
          };
          idx.entries.push(
            buildEntry(
              stamped,
              record.repositoryPath,
              Buffer.byteLength(raw, 'utf8'),
            ),
          );
        } catch (err) {
          console.warn(
            '[TrailPersistence] Skipping unparseable file',
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
