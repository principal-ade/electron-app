/**
 * Renderer-side service for Topic management.
 *
 * Static wrapper around the topic TIPC client. UI code reaches for this,
 * not the raw client, so cross-cutting concerns (telemetry, error
 * shaping) can be added in one place.
 */

// Mirror the TopicAPI contract this service wraps: the tipc client returns the
// desktop DraftTopic (which carries `repos`, `status`, assets), not the older
// alexandria-core Topic. Aliasing keeps every method's `Topic` in sync with it.
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import type {
  CreateTopicInput,
  TopicChangeEvent,
  UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';
import { topicClient } from '../tipc/topicClient';

export class TopicService {
  /**
   * Subscribe to topic change events. Uses legacy IPC under the hood since
   * TIPC doesn't support events.
   */
  static onTopicChange(
    callback: (event: TopicChangeEvent) => void,
  ): () => void {
    return window.mainProcess.topics.onTopicChange(callback);
  }

  static async getTopics(): Promise<Topic[]> {
    return topicClient.getTopics();
  }

  static async getTopic(id: string): Promise<Topic | null> {
    return topicClient.getTopic({ id });
  }

  static async createTopic(input: CreateTopicInput): Promise<Topic> {
    return topicClient.createTopic(input);
  }

  static async updateTopic(
    id: string,
    updates: UpdateTopicInput,
  ): Promise<Topic> {
    return topicClient.updateTopic({ id, updates });
  }

  /**
   * Append text to the bottom of a topic's markdown description. Atomic in
   * main (read-modify-write + TOPIC_UPDATED broadcast), with a blank-line
   * separator between the existing body and the new text. Used by the
   * drag-to-notes drop target in the Alexandria description overlay.
   */
  static async appendToDescription(id: string, text: string): Promise<Topic> {
    return topicClient.appendDescription({ id, text });
  }

  /**
   * Store a screenshot dragged into a topic's description. Main stores the
   * bytes inline on the topic (deduped by content hash) and appends the
   * `asset://<id>` reference to the description, broadcasting TOPIC_UPDATED.
   */
  static async attachImageAsset(
    topicId: string,
    asset: { id: string; mime: string; data: string; alt?: string },
  ): Promise<Topic> {
    return topicClient.attachImageAsset({ topicId, asset });
  }

  static async deleteTopic(id: string): Promise<boolean> {
    return topicClient.deleteTopic({ id });
  }

  /**
   * Absolute on-disk path of a topic's JSON file
   * (`~/.principal/topics/<id>.json`), for the header's "Copy path" action.
   * Returns `null` when the topic is unknown or while the legacy
   * `~/.alexandria/topics.json` blob is still the backend (no per-topic file).
   */
  static async getFilePath(id: string): Promise<string | null> {
    return topicClient.getTopicFilePath({ id });
  }
}
