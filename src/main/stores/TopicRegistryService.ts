/**
 * TopicRegistryService — main-process owner of topic persistence.
 *
 * Two-layer store:
 *
 * 1. Canonical Topic shape lives in the alexandria-core-library's TopicManager,
 *    persisted at `~/.alexandria/topics.json`. This matches what web-ade ships
 *    so the same payload publishes cleanly.
 *
 * 2. Desktop-only sync metadata (origin, remoteId, visibility, timestamps)
 *    lives in a sidecar file `~/.alexandria/topics-sync.json` keyed by
 *    topic id. Joined at read time to produce LocalTopicRecord.
 *
 * Consumers that only need the canonical payload use {@link getTopic}/
 * {@link getTopics}; sync/publish UIs use {@link getRecord}/{@link getRecords}.
 */

import {
  AlexandriaOutpostManager,
  type Topic,
} from '@principal-ai/alexandria-core-library';
import {
  NodeFileSystemAdapter,
  NodeGlobAdapter,
} from '@principal-ai/alexandria-core-library/node';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type {
  CreateTopicInput,
  LocalTopicRecord,
  LocalTopicSync,
  PublishTopicResult,
  UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';
import {
  addTrailOnWebAde,
  patchTopicOnWebAde,
  publishTopicToWebAde,
  removeTrailOnWebAde,
  reorderTrailsOnWebAde,
} from '../topics/topicShare';
import { getTrailStore } from '../file-city/trailStore';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';

/**
 * Pull the web-ade trail id out of a shared trail's `sharedUrl`
 * (`…/trail/{id}`). The desktop doesn't persist the server id as its own
 * field — `sharedUrl` (set by `markShared` at share time) is the record of
 * the trail's web-ade identity.
 */
function trailIdFromSharedUrl(sharedUrl: string): string | null {
  const match = sharedUrl.match(/\/trail\/([^/?#]+)/);
  return match ? match[1] : null;
}

interface TopicsSyncFile {
  version: string;
  /** Map of topicId → sync metadata. */
  records: Record<string, LocalTopicSync>;
  /**
   * Map of agent session id → topic id. Populated when an agent fetches a
   * topic via GET /api/topics/:id; the URL parse in the event server signals
   * intent so the session shows up as "working on this topic".
   */
  sessionLinks?: Record<string, string>;
}

const SYNC_FILE_VERSION = '1.0.0';

export class TopicRegistryService {
  private static instance: TopicRegistryService;
  private outpostManager: AlexandriaOutpostManager;
  private syncFilePath: string;
  private registryDir: string;

  private constructor() {
    const fsAdapter = new NodeFileSystemAdapter();
    const globAdapter = new NodeGlobAdapter();
    const homeDir = homedir();
    this.outpostManager = new AlexandriaOutpostManager(
      fsAdapter,
      globAdapter,
      homeDir,
    );
    this.registryDir = join(homeDir, '.alexandria');
    this.syncFilePath = join(this.registryDir, 'topics-sync.json');
  }

  static getInstance(): TopicRegistryService {
    if (!TopicRegistryService.instance) {
      TopicRegistryService.instance = new TopicRegistryService();
    }
    return TopicRegistryService.instance;
  }

  // ===== Topic CRUD =====

  async getTopics(): Promise<Topic[]> {
    return this.outpostManager.topics.getTopics();
  }

  async getTopic(id: string): Promise<Topic | null> {
    return this.outpostManager.topics.getTopic(id);
  }

  async createTopic(input: CreateTopicInput): Promise<Topic> {
    const topic = await this.outpostManager.topics.createTopic({
      id: input.id,
      title: input.title,
      description: input.description,
      trailIds: input.trailIds ?? [],
      createdBy: input.createdBy,
    });

    // Seed sync metadata for the new local topic.
    const sync: LocalTopicSync = {
      origin: 'local',
      visibility: input.visibility ?? 'sharable',
      locallyModifiedAt: topic.updatedAt,
    };
    this.writeSync(topic.id, sync);

    return topic;
  }

  async updateTopic(id: string, updates: UpdateTopicInput): Promise<Topic> {
    const { visibility, ...topicUpdates } = updates;
    const existing = this.readSync(id);
    const editsContent =
      topicUpdates.title !== undefined || topicUpdates.description !== undefined;

    // Source-of-truth gate: a published topic's content edits write through to
    // web-ade first, and the local copy is reconciled from the server's
    // response. On remote failure this throws before touching local, so the
    // local copy never diverges. (`visibility` is local-only — it doesn't
    // cross the wire, so a visibility-only change skips the remote call.)
    if (existing?.remoteId && editsContent) {
      const remote = await patchTopicOnWebAde(existing.remoteId, {
        ...(topicUpdates.title !== undefined
          ? { title: topicUpdates.title }
          : {}),
        ...(topicUpdates.description !== undefined
          ? { description: topicUpdates.description }
          : {}),
      });
      const local = await this.outpostManager.topics.updateTopic(id, {
        title: remote.title,
        description: remote.description,
      });
      const now = new Date().toISOString();
      this.writeSync(id, {
        ...existing,
        visibility: visibility ?? existing.visibility,
        lastSyncedAt: now,
        locallyModifiedAt: local.updatedAt,
      });
      return local;
    }

    const topic = await this.outpostManager.topics.updateTopic(id, topicUpdates);

    // Patch sync metadata: visibility may have changed; locallyModifiedAt
    // always bumps when the canonical payload changes.
    const base = existing ?? this.defaultSync(topic.updatedAt);
    this.writeSync(id, {
      ...base,
      visibility: visibility ?? base.visibility,
      locallyModifiedAt: topic.updatedAt,
    });

    return topic;
  }

  async deleteTopic(id: string): Promise<boolean> {
    const removed = await this.outpostManager.topics.deleteTopic(id);
    if (removed) {
      this.deleteSync(id);
    }
    return removed;
  }

  // ===== Trail membership =====

  async addTrailToTopic(topicId: string, trailId: string): Promise<Topic> {
    // Write-through when published: the remote add is gated (trail must be
    // shared, no dupes, 50-cap) and throws on rejection, so local membership
    // only changes after web-ade accepts it.
    const existing = this.readSync(topicId);
    if (existing?.remoteId) {
      // Remote references the trail by its web-ade id; share the local trail
      // first if it isn't already, then add by the resolved id.
      const [remoteTrailId] = await this.resolveRemoteTrailIds([trailId], {
        shareIfNeeded: true,
      });
      await addTrailOnWebAde(existing.remoteId, remoteTrailId);
      const local = await this.outpostManager.topics.addTrailToTopic(
        topicId,
        trailId,
      );
      this.touchSynced(topicId, local.updatedAt);
      return local;
    }
    const topic = await this.outpostManager.topics.addTrailToTopic(
      topicId,
      trailId,
    );
    this.touchSync(topicId, topic.updatedAt);
    return topic;
  }

  async removeTrailFromTopic(
    topicId: string,
    trailId: string,
  ): Promise<Topic> {
    const existing = this.readSync(topicId);
    if (existing?.remoteId) {
      // The trail is already in a published topic, so it's already shared —
      // resolve its web-ade id (no re-share) and remove by that id.
      const [remoteTrailId] = await this.resolveRemoteTrailIds([trailId], {
        shareIfNeeded: false,
      });
      await removeTrailOnWebAde(existing.remoteId, remoteTrailId);
      const local = await this.outpostManager.topics.removeTrailFromTopic(
        topicId,
        trailId,
      );
      this.touchSynced(topicId, local.updatedAt);
      return local;
    }
    const topic = await this.outpostManager.topics.removeTrailFromTopic(
      topicId,
      trailId,
    );
    this.touchSync(topicId, topic.updatedAt);
    return topic;
  }

  async reorderTopicTrails(
    topicId: string,
    trailIds: string[],
  ): Promise<Topic> {
    const existing = this.readSync(topicId);
    if (existing?.remoteId) {
      // Reorder is a permutation of already-shared trails — translate the
      // local order into web-ade ids without sharing anything new.
      const remoteOrder = await this.resolveRemoteTrailIds(trailIds, {
        shareIfNeeded: false,
      });
      await reorderTrailsOnWebAde(existing.remoteId, remoteOrder);
      const local = await this.outpostManager.topics.reorderTopicTrails(
        topicId,
        trailIds,
      );
      this.touchSynced(topicId, local.updatedAt);
      return local;
    }
    const topic = await this.outpostManager.topics.reorderTopicTrails(
      topicId,
      trailIds,
    );
    this.touchSync(topicId, topic.updatedAt);
    return topic;
  }

  // ===== Publishing =====

  /**
   * Publish a local topic to web-ade and stamp the server-assigned id onto
   * `sync.remoteId`. After this, the topic is sync-gated — subsequent edits
   * write through to web-ade (see {@link updateTopic} et al.). Throws,
   * leaving local state untouched, when the publish fails (e.g. a referenced
   * trail isn't shared yet). Re-publishing an already-published topic is a
   * no-op that just returns its current record + link.
   */
  async publishTopic(id: string): Promise<PublishTopicResult> {
    const topic = await this.getTopic(id);
    if (!topic) {
      throw new Error(`No local topic with id ${id}.`);
    }
    const existing = this.readSync(id) ?? this.defaultSync(topic.updatedAt);
    if (existing.remoteId) {
      return {
        url: this.topicUrl(existing.remoteId),
        record: { topic, sync: existing },
      };
    }

    // A topic stores LOCAL trail ids, but web-ade references trails by their
    // server-minted id. Resolve each: already-shared trails contribute the id
    // from their `sharedUrl`; unshared ones are published now (sharing mints
    // the id we then reference).
    const remoteTrailIds = await this.resolveRemoteTrailIds(topic.trailIds, {
      shareIfNeeded: true,
    });

    const published = await publishTopicToWebAde({
      title: topic.title,
      description: topic.description,
      trailIds: remoteTrailIds,
    });
    const now = new Date().toISOString();
    const sync: LocalTopicSync = {
      ...existing,
      remoteId: published.id,
      lastSyncedAt: now,
      locallyModifiedAt: now,
    };
    this.writeSync(id, sync);
    return { url: published.url, record: { topic, sync } };
  }

  /**
   * Translate a topic's LOCAL trail ids into the web-ade trail ids a
   * published topic must reference. An already-shared trail contributes the
   * id parsed from its `sharedUrl`; an unshared trail is published now (when
   * `shareIfNeeded`) and contributes the id `share` returns. Throws a typed
   * `TrailShareError` — surfaced to the user — when a trail can't be resolved
   * (not in the local library, or unshared while `shareIfNeeded` is false).
   */
  private async resolveRemoteTrailIds(
    localTrailIds: string[],
    opts: { shareIfNeeded: boolean },
  ): Promise<string[]> {
    if (localTrailIds.length === 0) return [];
    const store = getTrailStore();
    const { entries } = await store.list();
    const byId = new Map(entries.map((e) => [e.id, e]));

    const remoteIds: string[] = [];
    for (const localId of localTrailIds) {
      const entry = byId.get(localId);
      if (!entry) {
        throw new TrailShareError(
          'PAYLOAD_NOT_FOUND',
          `Trail ${localId} isn't in your local library, so it can't be published with this topic.`,
        );
      }
      if (entry.sharedAt && entry.sharedUrl) {
        const webAdeId = trailIdFromSharedUrl(entry.sharedUrl);
        if (!webAdeId) {
          throw new TrailShareError(
            'WEB_ADE_ERROR',
            `Couldn't read the shared id for trail "${entry.title}".`,
          );
        }
        remoteIds.push(webAdeId);
      } else if (opts.shareIfNeeded) {
        const result = await store.share(localId);
        remoteIds.push(result.id);
      } else {
        throw new TrailShareError(
          'SHARE_NOT_FOUND',
          `Trail "${entry.title}" must be shared before it can be on a published topic.`,
        );
      }
    }
    return remoteIds;
  }

  async getTopicsForTrail(trailId: string): Promise<Topic[]> {
    return this.outpostManager.topics.getTopicsForTrail(trailId);
  }

  // ===== Agent session links =====

  /**
   * Link an agent session id to a topic. Idempotent — re-linking the same
   * session overwrites the previous topic (a session works on one topic
   * at a time). Returns true when the map actually changed, false on a
   * no-op re-link, so callers can gate downstream broadcasts.
   */
  linkSession(topicId: string, sessionId: string): boolean {
    const file = this.readSyncFile();
    const links = file.sessionLinks ?? {};
    if (links[sessionId] === topicId) return false;
    links[sessionId] = topicId;
    file.sessionLinks = links;
    this.writeSyncFile(file);
    return true;
  }

  /** Read the full session→topic junction map. */
  getSessionLinks(): Record<string, string> {
    return { ...(this.readSyncFile().sessionLinks ?? {}) };
  }

  // ===== Record accessors (canonical + sync) =====

  async getRecord(id: string): Promise<LocalTopicRecord | null> {
    const topic = await this.getTopic(id);
    if (!topic) return null;
    const sync = this.readSync(id) ?? this.defaultSync(topic.updatedAt);
    return { topic, sync };
  }

  async getRecords(): Promise<LocalTopicRecord[]> {
    const topics = await this.getTopics();
    const syncMap = this.readSyncFile().records;
    return topics.map((topic) => ({
      topic,
      sync: syncMap[topic.id] ?? this.defaultSync(topic.updatedAt),
    }));
  }

  // ===== Sync file helpers =====

  private ensureRegistryDir(): void {
    if (!existsSync(this.registryDir)) {
      mkdirSync(this.registryDir, { recursive: true });
    }
  }

  private readSyncFile(): TopicsSyncFile {
    if (!existsSync(this.syncFilePath)) {
      return { version: SYNC_FILE_VERSION, records: {} };
    }
    try {
      const content = readFileSync(this.syncFilePath, 'utf-8');
      const parsed = JSON.parse(content) as TopicsSyncFile;
      // Defensive: tolerate older shapes by coercing missing `records` to {}.
      // `sessionLinks` must be threaded through — dropping it makes every
      // subsequent linkSession clobber existing links, and makes the
      // SessionsPanel render empty even when links exist on disk.
      return {
        version: parsed.version ?? SYNC_FILE_VERSION,
        records: parsed.records ?? {},
        sessionLinks: parsed.sessionLinks,
      };
    } catch (err) {
      console.error(
        '[TopicRegistryService] Failed to read topics-sync.json; treating as empty:',
        err,
      );
      return { version: SYNC_FILE_VERSION, records: {} };
    }
  }

  private writeSyncFile(data: TopicsSyncFile): void {
    this.ensureRegistryDir();
    writeFileSync(this.syncFilePath, JSON.stringify(data, null, 2));
  }

  private readSync(topicId: string): LocalTopicSync | null {
    const file = this.readSyncFile();
    return file.records[topicId] ?? null;
  }

  private writeSync(topicId: string, sync: LocalTopicSync): void {
    const file = this.readSyncFile();
    file.records[topicId] = sync;
    this.writeSyncFile(file);
  }

  private deleteSync(topicId: string): void {
    const file = this.readSyncFile();
    if (file.records[topicId]) {
      delete file.records[topicId];
      this.writeSyncFile(file);
    }
  }

  /** Bump `locallyModifiedAt` without other changes. Used after trail edits. */
  private touchSync(topicId: string, isoTimestamp: string): void {
    const existing = this.readSync(topicId) ?? this.defaultSync(isoTimestamp);
    this.writeSync(topicId, {
      ...existing,
      locallyModifiedAt: isoTimestamp,
    });
  }

  /**
   * Bump both `lastSyncedAt` and `locallyModifiedAt`. Used after a write-
   * through edit lands on web-ade, so the two timestamps stay equal (the
   * local copy is, by construction, identical to the just-confirmed remote).
   */
  private touchSynced(topicId: string, isoTimestamp: string): void {
    const existing = this.readSync(topicId) ?? this.defaultSync(isoTimestamp);
    this.writeSync(topicId, {
      ...existing,
      lastSyncedAt: isoTimestamp,
      locallyModifiedAt: isoTimestamp,
    });
  }

  /** Public web-ade URL for a published topic, from the same base the share
   *  calls use. */
  private topicUrl(remoteId: string): string {
    const base = (
      process.env.WEB_ADE_API_URL || 'https://app.principal-ade.com/api'
    ).replace(/\/api\/?$/, '');
    return `${base}/topic/${remoteId}`;
  }

  /**
   * Default sync metadata for a record we don't have explicit sync state for
   * (e.g. a topic created before the sync sidecar existed, or one we just
   * read after a partial write). Treat it as a local-origin sharable topic
   * whose locally-modified time matches the canonical payload.
   */
  private defaultSync(isoTimestamp: string): LocalTopicSync {
    return {
      origin: 'local',
      visibility: 'sharable',
      locallyModifiedAt: isoTimestamp,
    };
  }
}
