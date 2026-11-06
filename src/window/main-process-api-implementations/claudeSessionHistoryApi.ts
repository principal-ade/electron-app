import { ipcRenderer } from 'electron';
import {
  ClaudeSessionHistoryEvents,
  type ClaudeSessionHistoryAPI,
} from '../../shared/main-process-api-interfaces/ClaudeSessionHistoryAPI';

export const claudeSessionHistoryAPI: ClaudeSessionHistoryAPI = {
  list: () => ipcRenderer.invoke(ClaudeSessionHistoryEvents.LIST),
  search: (query) =>
    ipcRenderer.invoke(ClaudeSessionHistoryEvents.SEARCH, query),
  resume: (directory, sessionId) =>
    ipcRenderer.invoke(ClaudeSessionHistoryEvents.RESUME, directory, sessionId),
};
