/**
 * Topic API implementation for preload scripts.
 *
 * TIPC for type-safe RPC calls; legacy IPC for event subscriptions
 * (TIPC doesn't support events). Method names prefixed with `topic_`.
 */

import { ipcRenderer } from 'electron';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import {
  TopicAPIEvent,
  TopicEventType,
  type CreateTopicInput,
  type TopicAPI,
  type TopicChangeEvent,
  type UpdateTopicInput,
} from '../../shared/main-process-api-interfaces/TopicAPI';

const tipcInvoke = <T>(method: string, input?: unknown): Promise<T> => {
  return ipcRenderer.invoke(`topic_${method}`, input);
};

export const topicAPI: TopicAPI = {
  onTopicChange: (callback: (event: TopicChangeEvent) => void) => {
    const handleAdded = (_event: Electron.IpcRendererEvent, data: Topic) => {
      callback({ type: TopicEventType.ADDED, topic: data });
    };
    const handleUpdated = (_event: Electron.IpcRendererEvent, data: Topic) => {
      callback({ type: TopicEventType.UPDATED, topic: data });
    };
    const handleRemoved = (
      _event: Electron.IpcRendererEvent,
      data: { id: string },
    ) => {
      callback({ type: TopicEventType.REMOVED, id: data.id });
    };

    ipcRenderer.on(TopicAPIEvent.TOPIC_ADDED, handleAdded);
    ipcRenderer.on(TopicAPIEvent.TOPIC_UPDATED, handleUpdated);
    ipcRenderer.on(TopicAPIEvent.TOPIC_REMOVED, handleRemoved);

    return () => {
      ipcRenderer.removeListener(TopicAPIEvent.TOPIC_ADDED, handleAdded);
      ipcRenderer.removeListener(TopicAPIEvent.TOPIC_UPDATED, handleUpdated);
      ipcRenderer.removeListener(TopicAPIEvent.TOPIC_REMOVED, handleRemoved);
    };
  },

  getTopics: () => tipcInvoke('getTopics'),

  getTopic: (id: string) => tipcInvoke('getTopic', { id }),

  createTopic: (input: CreateTopicInput) => tipcInvoke('createTopic', input),

  updateTopic: (id: string, updates: UpdateTopicInput) =>
    tipcInvoke('updateTopic', { id, updates }),

  deleteTopic: (id: string) => tipcInvoke('deleteTopic', { id }),
};
