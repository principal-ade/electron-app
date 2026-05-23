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
  UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';

interface TopicsSyncFile {
  version: string;
  /** Map of topicId → sync metadata. */
  records: Record<string, LocalTopicSync>;
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
    const topic = await this.outpostManager.topics.updateTopic(id, topicUpdates);

    // Patch sync metadata: visibility may have changed; locallyModifiedAt
    // always bumps when the canonical payload changes.
    const existing = this.readSync(id) ?? this.defaultSync(topic.updatedAt);
    this.writeSync(id, {
      ...existing,
      visibility: visibility ?? existing.visibility,
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
    const topic = await this.outpostManager.topics.reorderTopicTrails(
      topicId,
      trailIds,
    );
    this.touchSync(topicId, topic.updatedAt);
    return topic;
  }

  async getTopicsForTrail(trailId: string): Promise<Topic[]> {
    return this.outpostManager.topics.getTopicsForTrail(trailId);
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
      return {
        version: parsed.version ?? SYNC_FILE_VERSION,
        records: parsed.records ?? {},
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
