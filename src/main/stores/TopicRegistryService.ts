/**
 * TopicRegistryService — main-process owner of topic persistence.
 *
 * Two-layer store:
 *
 * 1. Canonical topic payload: a file-per-topic `TopicStore` at
 *    `~/.principal/topics/`, owned by `@principal-ai/subsystems-core`.
 *
 * 2. Agent session→topic links live in a sidecar file
 *    `~/.alexandria/topics-sync.json`.
 *
 */

import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import { TopicStore, TOPICS_DIR } from '@principal-ai/subsystems-core/node';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type {
  CreateTopicInput,
  UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';

interface TopicsSyncFile {
  version: string;
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
   * Mirrors the topic store's path derivation, backing the topic header's
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
    return this.topicStore.createTopic({
      id: input.id,
      title: input.title,
      description: input.description,
      createdBy: input.createdBy,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.repos !== undefined ? { repos: input.repos } : {}),
    });
  }

  async updateTopic(id: string, updates: UpdateTopicInput): Promise<Topic> {
    return this.topicStore.updateTopic(id, updates);
  }

  async deleteTopic(id: string): Promise<boolean> {
    return this.topicStore.deleteTopic(id);
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

  // ===== Sync file helpers =====

  private ensureRegistryDir(): void {
    if (!existsSync(this.registryDir)) {
      mkdirSync(this.registryDir, { recursive: true });
    }
  }

  private readSyncFile(): TopicsSyncFile {
    if (!existsSync(this.syncFilePath)) {
      return { version: SYNC_FILE_VERSION };
    }
    try {
      const content = readFileSync(this.syncFilePath, 'utf-8');
      const parsed = JSON.parse(content) as TopicsSyncFile;
      // `sessionLinks` must be threaded through — dropping it makes every
      // subsequent linkSession clobber existing links, and makes the
      // SessionsPanel render empty even when links exist on disk.
      return {
        version: parsed.version ?? SYNC_FILE_VERSION,
        sessionLinks: parsed.sessionLinks,
      };
    } catch (err) {
      console.error(
        '[TopicRegistryService] Failed to read topics-sync.json; treating as empty:',
        err,
      );
      return { version: SYNC_FILE_VERSION };
    }
  }

  private writeSyncFile(data: TopicsSyncFile): void {
    this.ensureRegistryDir();
    writeFileSync(this.syncFilePath, JSON.stringify(data, null, 2));
  }
}
