/**
 * Renderer-side service for Topic management.
 *
 * Static wrapper around the topic TIPC client. UI code reaches for this,
 * not the raw client, so cross-cutting concerns (telemetry, error
 * shaping) can be added in one place.
 */

import type { Topic } from '@principal-ai/alexandria-core-library/types';
import type {
  CreateTopicInput,
  LocalTopicRecord,
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

  static async deleteTopic(id: string): Promise<boolean> {
    return topicClient.deleteTopic({ id });
  }

  static async addTrailToTopic(
    topicId: string,
    trailId: string,
  ): Promise<Topic> {
    return topicClient.addTrailToTopic({ topicId, trailId });
  }

  static async removeTrailFromTopic(
    topicId: string,
    trailId: string,
  ): Promise<Topic> {
    return topicClient.removeTrailFromTopic({ topicId, trailId });
  }

  static async reorderTopicTrails(
    topicId: string,
    trailIds: string[],
  ): Promise<Topic> {
    return topicClient.reorderTopicTrails({ topicId, trailIds });
  }

  static async getTopicsForTrail(trailId: string): Promise<Topic[]> {
    return topicClient.getTopicsForTrail({ trailId });
  }

  /** Full LocalTopicRecord including sync metadata (for sync UI). */
  static async getRecord(id: string): Promise<LocalTopicRecord | null> {
    return topicClient.getRecord({ id });
  }

  /** All LocalTopicRecords. */
  static async getRecords(): Promise<LocalTopicRecord[]> {
    return topicClient.getRecords();
  }
}
