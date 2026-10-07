/**
 * TopicRegistryService — main-process owner of topic persistence.
 *
 * Two-layer store:
 *
 * 1. Canonical topic payload: a file-per-topic `TopicStore` at
 *    `~/.principal/topics/`, owned by `@principal-ai/subsystems-core`.
 *
 * 2. Desktop-only sync metadata (origin, remoteId, visibility, timestamps)
 *    lives in a sidecar file `~/.alexandria/topics-sync.json` keyed by
 *    topic id. Joined at read time to produce LocalTopicRecord.
 *
 * Consumers that only need the canonical payload use {@link getTopic}/
 * {@link getTopics}; sync/publish UIs use {@link getRecord}/{@link getRecords}.
 */

import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import { TopicStore, TOPICS_DIR } from '@principal-ai/subsystems-core/node';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type {
  CreateTopicInput,
  LocalTopicRecord,
  LocalTopicSync,
  PublishedTopicVisibility,
  PublishTopicResult,
  UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';

import { patchTopicOnWebAde, publishTopicToWebAde } from '../topics/topicShare';
import { isPublishableRepoPurl } from '../../shared/topics/repoPurl';

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
  private topicStore: TopicStore;
  private syncFilePath: string;
  private registryDir: string;

  private constructor() {
    const homeDir = homedir();
    this.topicStore = new TopicStore();
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
    return this.topicStore.getTopics();
  }

  async getTopic(id: string): Promise<Topic | null> {
    return this.topicStore.getTopic(id);
  }

  /**
   * Absolute on-disk path of a topic's JSON in the file-per-topic store
   * (`~/.principal/topics/<id>.json`). Returns `null` for an unknown topic.
   * Mirrors the trail store's `getFilePath`, backing the topic header's
   * "Copy path" action.
   */
  async getTopicFilePath(id: string): Promise<string | null> {
    const topic = await this.topicStore.getTopic(id);
    if (!topic) return null;
    // Mirrors TopicStore's filename derivation (sanitizeSegment + '.json').
    const fileName = `${id.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
    return join(TOPICS_DIR, fileName);
  }

  async createTopic(input: CreateTopicInput): Promise<Topic> {
    const topic = await this.topicStore.createTopic({
      id: input.id,
      title: input.title,
      description: input.description,
      createdBy: input.createdBy,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.repos !== undefined ? { repos: input.repos } : {}),
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
      topicUpdates.title !== undefined ||
      topicUpdates.description !== undefined ||
      topicUpdates.status !== undefined;

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
        ...(topicUpdates.status !== undefined
          ? { status: topicUpdates.status }
          : {}),
      });
      const local = await this.topicStore.updateTopic(id, {
        title: remote.title,
        description: remote.description,
        status: remote.status,
        // repos is a locally-derived field (mirrored from workspace membership),
        // not part of the remote write-through gate — preserve a concurrent
        // repos edit locally rather than dropping it on the remote reconcile.
        // It's snapshotted to the server at publish; see publishTopicToWebAde.
        ...(topicUpdates.repos !== undefined
          ? { repos: topicUpdates.repos }
          : {}),
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

    const topic = await this.topicStore.updateTopic(id, topicUpdates);

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
    const removed = await this.topicStore.deleteTopic(id);
    if (removed) {
      this.deleteSync(id);
    }
    return removed;
  }

  // ===== Publishing =====

  /**
   * Publish a local topic to web-ade and stamp the server-assigned id onto
   * `sync.remoteId`. After this, the topic is sync-gated — subsequent edits
   * write through to web-ade (see {@link updateTopic} et al.). Throws,
   * leaving local state untouched when the publish fails. Re-publishing an already-published topic is a
   * no-op that just returns its current record + link.
   *
   * `visibility` is the web-ade audience (`'private' | 'public'`) — a per-publish
   * choice, distinct from the local `sync.visibility` intent flag.
   */
  async publishTopic(
    id: string,
    visibility: PublishedTopicVisibility,
  ): Promise<PublishTopicResult> {
    const topic = await this.getTopic(id);
    if (!topic) {
      throw new Error(`No local topic with id ${id}.`);
    }
    const existing = this.readSync(id) ?? this.defaultSync(topic.updatedAt);
    if (existing.remoteId) {
      return {
        url: this.topicUrl(existing.remoteId),
        record: { topic, sync: existing },
        visibility,
      };
    }

    // Only portable repo PURLs cross the wire — machine-local ones
    // (`pkg:generic/local/...`) are meaningless to other readers and web-ade
    // rejects them, so drop them from the published snapshot (they stay local).
    const publishableRepos = topic.repos?.filter(isPublishableRepoPurl);

    const published = await publishTopicToWebAde({
      title: topic.title,
      description: topic.description,
      visibility,
      ...(topic.status !== undefined ? { status: topic.status } : {}),
      ...(publishableRepos !== undefined ? { repos: publishableRepos } : {}),
    });
    const now = new Date().toISOString();
    const sync: LocalTopicSync = {
      ...existing,
      remoteId: published.id,
      lastSyncedAt: now,
      locallyModifiedAt: now,
    };
    this.writeSync(id, sync);
    return {
      url: published.url,
      record: { topic, sync },
      visibility,
    };
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
