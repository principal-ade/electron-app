/**
 * Disk persistence for File City trail payloads.
 *
 * Layout under `~/.principal/trails/` — same path the CLI's trail cache
 * (`@principal-ai/principal-view-cli`) uses, so the standalone trail-viewer
 * can read trails authored by the desktop app and vice-versa:
 *
 *   ~/.principal/trails/
 *     _index.json                          host-private manifest (entries[])
 *     <purl-ns>/<purl-name>/<id>.json      payload anchored by repos[0] Purl
 *     by-id/<id>.json                      fallback when no Purl can be derived
 *
 * Each per-trail file is the raw `TrailPayload` JSON — no wrapper. The
 * host-private `repositoryPath` (which clone on this machine produced the
 * trail) and `cachePath` (which bucket the file landed in) live on the
 * index entry only, never in the payload. The manifest is rebuilt by
 * scanning the tree if missing or unparseable; on first run we also
 * migrate any trails left in the old `<userData>/file-city-trails/` layout.
 *
 * There is no "active trail" on disk. The trail a given dev-workspace
 * window is showing is a per-window concept, plumbed via the `openTrailId`
 * URL argument at window creation and broadcast updates via PAYLOAD_SET.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import {
  createLocalRepoPurl,
  parsePurl,
  type Purl,
} from '@principal-ai/alexandria-core-library';
import type { TrailIndexEntry } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

const BY_ID_DIR = 'by-id';
const INDEX_FILENAME = '_index.json';

/**
 * Thrown by `save()` when a content edit targets a trail that has already
 * been shared (its index entry carries `sharedAt`). Shared trails are kept
 * locally but locked — re-authoring the id is rejected so the published
 * snapshot stays the source of truth. The HTTP POST route maps this to a
 * 409. Notes are unaffected: they go through `applyToPayload`, not `save`.
 */
export class TrailLockedError extends Error {
  constructor(public readonly trailId: string) {
    super(
      `Trail ${trailId} is shared and locked; content edits are not allowed.`,
    );
    this.name = 'TrailLockedError';
  }
}
const SUMMARY_PREVIEW_MAX = 200;
const PER_REPO_CAP = 50;

interface IndexEntryV2 extends TrailIndexEntry {
  /** Path relative to ROOT (e.g. `github/owner/repo/abc.json`, `by-id/abc.json`). */
  cachePath: string;
}

interface IndexFileV2 {
  version: 2;
  entries: IndexEntryV2[];
}

const emptyIndex = (): IndexFileV2 => ({
  version: 2,
  entries: [],
});

const summaryPreview = (summary?: string): string => {
  if (!summary) return '';
  const trimmed = summary.trim();
  if (trimmed.length <= SUMMARY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, SUMMARY_PREVIEW_MAX - 1)}…`;
};

const hasDiffSnippets = (payload: TrailPayload): boolean =>
  payload.markers.some((m) => m.snippet?.kind === 'diff');

const repoNamesOf = (payload: TrailPayload): string[] =>
  (payload.repos ?? []).map((r) => r.name).filter(Boolean);

const distinctFileCount = (payload: TrailPayload): number => {
  const paths = new Set<string>();
  for (const m of payload.markers) {
    if (m.sourcePath) paths.add(m.sourcePath);
  }
  return paths.size;
};

const sanitizeSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]/g, '_');

/**
 * Decide which on-disk bucket a trail's JSON should live in. Mirrors the CLI
 * trail cache locator so both producers write to the same shape:
 *   1. `repos[0].id` parses as Purl → `<namespace>/<name>/`
 *   2. `repositoryPath` provided   → mint a `pkg:local/...` Purl from it
 *   3. neither                      → `by-id/`
 */
function chooseBucket(
  payload: TrailPayload,
  repositoryPath: string | undefined,
): { bucket: string; cachePath: string } {
  const id = sanitizeSegment(payload.id);

  const fromRepos = bucketFromPurl(payload.repos?.[0]?.id, id);
  if (fromRepos) return fromRepos;

  if (repositoryPath) {
    const localPurl = createLocalRepoPurl(path.resolve(repositoryPath));
    const fromLocal = bucketFromPurl(localPurl, id);
    if (fromLocal) return fromLocal;
  }

  return { bucket: BY_ID_DIR, cachePath: path.join(BY_ID_DIR, `${id}.json`) };
}

function bucketFromPurl(
  purl: Purl | string | undefined,
  safeId: string,
): { bucket: string; cachePath: string } | null {
  if (typeof purl !== 'string') return null;
  const parsed = parsePurl(purl);
  if (!parsed?.namespace) return null;
  const ns = sanitizeSegment(parsed.namespace);
  const name = sanitizeSegment(parsed.name);
  if (!ns || !name) return null;
  const bucket = path.join(ns, name);
  return { bucket, cachePath: path.join(bucket, `${safeId}.json`) };
}

const buildEntry = (
  payload: TrailPayload,
  repositoryPath: string | undefined,
  sizeBytes: number,
  cachePath: string,
  derivedFrom: string | undefined,
  shared: { sharedAt?: string; sharedUrl?: string } = {},
): IndexEntryV2 => ({
  id: payload.id,
  title: payload.title || 'Untitled trail',
  summaryPreview: summaryPreview(payload.summary),
  markerCount: payload.markers.length,
  fileCount: distinctFileCount(payload),
  purpose: payload.purpose,
  signOffCount: payload.signOffs?.length ?? 0,
  repoNames: repoNamesOf(payload),
  hasDiffSnippets: hasDiffSnippets(payload),
  createdAt: payload.createdAt,
  updatedAt: payload.updatedAt,
  sizeBytes,
  repositoryPath,
  derivedFrom,
  sharedAt: shared.sharedAt,
  sharedUrl: shared.sharedUrl,
  cachePath,
});

const stripCachePath = ({
  cachePath: _cachePath,
  ...rest
}: IndexEntryV2): TrailIndexEntry => rest;

export class TrailPersistence {
  private readonly baseDir: string;
  private readonly indexPath: string;
  private readonly legacyBaseDir: string;
  private index: IndexFileV2 | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.baseDir = path.join(os.homedir(), '.principal', 'trails');
    this.indexPath = path.join(this.baseDir, INDEX_FILENAME);
    this.legacyBaseDir = path.join(
      app.getPath('userData'),
      'file-city-trails',
    );
  }

  private async getIndex(): Promise<IndexFileV2> {
    if (!this.index) {
      await fs.mkdir(this.baseDir, { recursive: true });
      this.index = await this.loadIndex();
      await this.backfillDerivedFields(this.index);
    }
    return this.index;
  }

  /**
   * Stamp derived fields (`purpose`, `fileCount`, `signOffCount`) onto
   * entries that were indexed before those fields existed. Reads each
   * affected entry's payload once, mutates the entry in place, and
   * persists the index if anything changed. Runs once per process —
   * `getIndex` caches the result.
   */
  private async backfillDerivedFields(idx: IndexFileV2): Promise<void> {
    const stale = idx.entries.filter(
      (e) =>
        e.purpose === undefined ||
        e.fileCount === undefined ||
        e.signOffCount === undefined,
    );
    if (stale.length === 0) return;
    let changed = 0;
    for (const entry of stale) {
      const payload = await this.readPayload(entry.cachePath);
      if (!payload) continue;
      if (entry.purpose === undefined) entry.purpose = payload.purpose;
      if (entry.fileCount === undefined) {
        entry.fileCount = distinctFileCount(payload);
      }
      if (entry.signOffCount === undefined) {
        entry.signOffCount = payload.signOffs?.length ?? 0;
      }
      changed++;
    }
    if (changed > 0) {
      console.info(
        `[TrailPersistence] Backfilled derived fields on ${changed} entr${changed === 1 ? 'y' : 'ies'}`,
      );
      await this.persistIndex();
    }
  }

  async listEntries(repositoryPath?: string): Promise<{
    entries: TrailIndexEntry[];
  }> {
    const idx = await this.getIndex();
    const entries = repositoryPath
      ? idx.entries.filter(
          (e) =>
            e.repositoryPath === repositoryPath || e.repositoryPath == null,
        )
      : idx.entries.slice();
    entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { entries: entries.map(stripCachePath) };
  }

  async loadById(id: string): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    return this.readPayload(entry.cachePath);
  }

  async loadEntryById(id: string): Promise<TrailIndexEntry | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    return entry ? stripCachePath(entry) : null;
  }

  /**
   * Resolve the absolute filesystem path of a trail's payload JSON. Built
   * from the host-private `cachePath` (stripped before entries reach the
   * renderer), so the renderer can't derive it itself. Returns `null` for
   * an unknown id.
   */
  async getFilePathById(id: string): Promise<string | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    return path.join(this.baseDir, entry.cachePath);
  }

  async save(
    incoming: TrailPayload,
    options: { repositoryPath?: string; derivedFrom?: string },
  ): Promise<{ payload: TrailPayload; evictedIds: string[] }> {
    const idx = await this.getIndex();
    const now = new Date().toISOString();
    const id = incoming.id?.trim() || crypto.randomUUID();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    const existing = existingIdx >= 0 ? idx.entries[existingIdx] : null;

    // Shared trails are locked: the published snapshot is the source of
    // truth, so reject content re-authoring of an already-shared id. Notes
    // are exempt — they flow through `applyToPayload`, not here.
    if (existing?.sharedAt) {
      throw new TrailLockedError(id);
    }

    // Lift notes from the existing payload on disk so external re-pushes
    // (which never carry `notes` — validation strips them) don't wipe
    // user-authored notes. Renderer note mutations go through
    // `applyToPayload`, which writes notes back onto the same record.
    let preservedNotes = incoming.notes;
    if (preservedNotes === undefined && existing) {
      const onDisk = await this.readPayload(existing.cachePath);
      preservedNotes = onDisk?.notes;
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
    // derivedFrom is stamped at fork time. Preserve the existing entry's
    // value on re-POST so the link doesn't get cleared by a vanilla update.
    const derivedFrom = options.derivedFrom ?? existing?.derivedFrom;
    const { cachePath } = chooseBucket(payload, repositoryPath);
    const file = path.join(this.baseDir, cachePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const serialized = JSON.stringify(payload, null, 2);
    await fs.writeFile(file, serialized, 'utf8');

    // If the bucket changed (e.g. payload gained a Purl), drop the stale file.
    if (existing && existing.cachePath !== cachePath) {
      await this.unlinkRelative(existing.cachePath);
    }

    const entry = buildEntry(
      payload,
      repositoryPath,
      Buffer.byteLength(serialized, 'utf8'),
      cachePath,
      derivedFrom,
      // Unshared by construction: a shared `existing` would have thrown
      // above, so these are always undefined here. Passed for symmetry.
      { sharedAt: existing?.sharedAt, sharedUrl: existing?.sharedUrl },
    );
    if (existingIdx >= 0) {
      idx.entries[existingIdx] = entry;
    } else {
      idx.entries.push(entry);
    }

    const evictedIds = await this.enforceCap(idx, repositoryPath);

    await this.persistIndex();
    return { payload, evictedIds };
  }

  async applyToPayload(
    id: string,
    mutator: (payload: TrailPayload) => TrailPayload,
  ): Promise<TrailPayload | null> {
    const idx = await this.getIndex();
    const existingIdx = idx.entries.findIndex((e) => e.id === id);
    if (existingIdx < 0) return null;
    const existing = idx.entries[existingIdx];
    const onDisk = await this.readPayload(existing.cachePath);
    if (!onDisk) return null;
    const now = new Date().toISOString();
    const stamped: TrailPayload = {
      ...onDisk,
      id,
      createdAt: onDisk.createdAt ?? existing.createdAt,
      updatedAt: onDisk.updatedAt ?? existing.updatedAt,
    };
    const mutated = mutator(stamped);
    const next: TrailPayload = {
      ...mutated,
      id,
      createdAt: stamped.createdAt,
      updatedAt: now,
    };
    const { cachePath } = chooseBucket(next, existing.repositoryPath);
    const file = path.join(this.baseDir, cachePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const serialized = JSON.stringify(next, null, 2);
    await fs.writeFile(file, serialized, 'utf8');
    if (existing.cachePath !== cachePath) {
      await this.unlinkRelative(existing.cachePath);
    }
    idx.entries[existingIdx] = buildEntry(
      next,
      existing.repositoryPath,
      Buffer.byteLength(serialized, 'utf8'),
      cachePath,
      existing.derivedFrom,
      // Preserve the shared marker: notes are allowed on a locked trail
      // and must not silently un-share it.
      { sharedAt: existing.sharedAt, sharedUrl: existing.sharedUrl },
    );
    await this.persistIndex();
    return next;
  }

  /**
   * Load a payload by id and return it alongside its host-private
   * `repositoryPath`. Used by route handlers that need to broadcast and
   * open a window for a known id without callers having to chain two reads.
   */
  async loadByIdWithRepoPath(
    id: string,
  ): Promise<{ payload: TrailPayload; repositoryPath?: string } | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    const payload = await this.readPayload(entry.cachePath);
    if (!payload) return null;
    return { payload, repositoryPath: entry.repositoryPath };
  }

  /**
   * Stamp an index entry as shared & locked after a successful web-ade
   * publish. Touches the index only — the payload file is unchanged. No-op
   * (returns null) if the id is unknown, e.g. the trail was evicted or
   * deleted between publish and stamp. Returns the entry's host-private
   * repositoryPath so callers can scope a LIBRARY_CHANGED broadcast.
   */
  async markShared(
    id: string,
    sharedUrl: string,
  ): Promise<{ repositoryPath?: string } | null> {
    const idx = await this.getIndex();
    const entry = idx.entries.find((e) => e.id === id);
    if (!entry) return null;
    entry.sharedAt = new Date().toISOString();
    entry.sharedUrl = sharedUrl;
    await this.persistIndex();
    return { repositoryPath: entry.repositoryPath };
  }

  async deleteById(
    id: string,
  ): Promise<{ repositoryPath?: string } | null> {
    const idx = await this.getIndex();
    const entryIdx = idx.entries.findIndex((e) => e.id === id);
    if (entryIdx < 0) return null;
    const entry = idx.entries[entryIdx];
    idx.entries.splice(entryIdx, 1);
    await this.unlinkRelative(entry.cachePath);
    await this.persistIndex();
    return { repositoryPath: entry.repositoryPath };
  }

  private async readPayload(cachePath: string): Promise<TrailPayload | null> {
    const file = path.join(this.baseDir, cachePath);
    try {
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as TrailPayload;
    } catch (err) {
      console.error('[TrailPersistence] Failed to load payload', cachePath, err);
      return null;
    }
  }

  private async unlinkRelative(cachePath: string): Promise<void> {
    const file = path.join(this.baseDir, cachePath);
    try {
      await fs.unlink(file);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.error('[TrailPersistence] Failed to unlink', cachePath, err);
      }
    }
  }

  private async enforceCap(
    idx: IndexFileV2,
    repositoryPath?: string,
  ): Promise<string[]> {
    const matching = idx.entries
      .filter((e) => e.repositoryPath === repositoryPath)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    if (matching.length <= PER_REPO_CAP) return [];
    const toEvict = matching.slice(PER_REPO_CAP);
    const evictedIds: string[] = [];
    for (const entry of toEvict) {
      await this.unlinkRelative(entry.cachePath);
      evictedIds.push(entry.id);
    }
    idx.entries = idx.entries.filter((e) => !evictedIds.includes(e.id));
    if (evictedIds.length > 0) {
      console.warn(
        `[TrailPersistence] Evicted ${evictedIds.length} entries for repo cap (${PER_REPO_CAP})`,
      );
    }
    return evictedIds;
  }

  private async loadIndex(): Promise<IndexFileV2> {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf8');
      // Older indexes carried an `active` field — read but ignore it; the
      // concept moved into per-window state.
      const parsed = JSON.parse(raw) as Partial<IndexFileV2>;
      if (parsed?.version === 2 && Array.isArray(parsed.entries)) {
        return {
          version: 2,
          entries: parsed.entries as IndexEntryV2[],
        };
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        console.warn(
          '[TrailPersistence] _index.json unreadable, rebuilding',
          err,
        );
      }
    }
    const migrated = await this.migrateLegacyIfPresent();
    if (migrated) return migrated;
    return this.rebuildIndex();
  }

  /**
   * Walk `<userData>/file-city-trails/` (the pre-`~/.principal/trails`
   * layout), copy every payload into the new tree, and return a populated
   * index. Leaves the legacy directory in place — the caller can clean it
   * up after a release once nothing reads it anymore.
   */
  private async migrateLegacyIfPresent(): Promise<IndexFileV2 | null> {
    let legacyRaw: string;
    try {
      legacyRaw = await fs.readFile(
        path.join(this.legacyBaseDir, 'index.json'),
        'utf8',
      );
    } catch {
      return null;
    }

    let legacyIndex: {
      entries?: Array<TrailIndexEntry>;
      active?: Record<string, string | null>;
    };
    try {
      legacyIndex = JSON.parse(legacyRaw);
    } catch {
      return null;
    }

    const idx = emptyIndex();
    let migrated = 0;
    for (const legacyEntry of legacyIndex.entries ?? []) {
      const subdir = legacyEntry.repositoryPath
        ? crypto
            .createHash('md5')
            .update(path.resolve(legacyEntry.repositoryPath))
            .digest('hex')
        : 'repo-agnostic';
      const legacyFile = path.join(
        this.legacyBaseDir,
        subdir,
        `${legacyEntry.id}.json`,
      );
      let raw: string;
      try {
        raw = await fs.readFile(legacyFile, 'utf8');
      } catch {
        continue;
      }
      let parsed: { payload?: TrailPayload } | TrailPayload;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const payload: TrailPayload =
        (parsed as { payload?: TrailPayload }).payload ??
        (parsed as TrailPayload);
      if (!payload?.id) continue;

      const { cachePath } = chooseBucket(payload, legacyEntry.repositoryPath);
      const file = path.join(this.baseDir, cachePath);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const serialized = JSON.stringify(payload, null, 2);
      await fs.writeFile(file, serialized, 'utf8');
      idx.entries.push(
        buildEntry(
          payload,
          legacyEntry.repositoryPath,
          Buffer.byteLength(serialized, 'utf8'),
          cachePath,
          legacyEntry.derivedFrom,
        ),
      );
      migrated++;
    }

    if (migrated > 0) {
      console.info(
        `[TrailPersistence] Migrated ${migrated} trail(s) from ${this.legacyBaseDir} to ${this.baseDir}`,
      );
    }

    this.index = idx;
    await this.persistIndex();
    return idx;
  }

  /**
   * Walk the on-disk tree rooted at `~/.principal/trails/` and rebuild the
   * index from whatever payloads we find. Skips the index file itself and
   * any non-JSON files.
   */
  private async rebuildIndex(): Promise<IndexFileV2> {
    const idx = emptyIndex();
    await this.walkAndIndex(this.baseDir, '', idx);
    return idx;
  }

  private async walkAndIndex(
    dir: string,
    relPrefix: string,
    idx: IndexFileV2,
  ): Promise<void> {
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await this.walkAndIndex(abs, rel, idx);
        continue;
      }
      if (entry.name === INDEX_FILENAME) continue;
      if (!entry.name.endsWith('.json')) continue;
      let raw: string;
      try {
        raw = await fs.readFile(abs, 'utf8');
      } catch {
        continue;
      }
      let parsed: TrailPayload;
      try {
        parsed = JSON.parse(raw) as TrailPayload;
      } catch {
        console.warn('[TrailPersistence] Skipping unparseable file', abs);
        continue;
      }
      const fallbackId = entry.name.replace(/\.json$/, '');
      const createdAt = parsed.createdAt ?? new Date().toISOString();
      const stamped: TrailPayload = {
        ...parsed,
        id: parsed.id || fallbackId,
        createdAt,
        updatedAt: parsed.updatedAt ?? createdAt,
        title: parsed.title || 'Untitled trail',
      };
      idx.entries.push(
        buildEntry(
          stamped,
          undefined,
          Buffer.byteLength(raw, 'utf8'),
          rel,
          undefined,
        ),
      );
    }
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
